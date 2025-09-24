const {
  createUser,
  findUserByEmail,
  getAllUsers,
} = require("../modules/userModule");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");
const { google } = require("googleapis");

const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);
oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
async function createTransporter() {
  const accessToken = await oAuth2Client.getAccessToken();

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.GMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken: accessToken.token,
    },
  });
}
exports.signup = async (req, res) => {
  try {
    const { user_name, user_email, user_number, password } = req.body;

    const existingUser = await findUserByEmail(user_email);
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Create user
    const newUser = await createUser({
      user_name,
      user_email,
      user_number,
      password,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: newUser,
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.signin = async (req, res) => {
  try {
    const { user_email, password } = req.body;

    // 1. Find user
    const user = await findUserByEmail(user_email);
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash || "");
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // 3. Generate JWT (include role & id inside the token as well if needed)
    const token = jwt.sign(
      {
        id: user.id,
        email: user.user_email,
        role: user.is_admin ? "admin" : "user",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 4. Respond with id + role
    res.json({
      message: "Sign in successful",
      token,
      user: {
        id: user.id,
        name: user.user_name,
        email: user.user_email,
        number: user.user_number,
        role: user.is_admin ? "admin" : "user",
      },
    });
  } catch (error) {
    console.error("Signin Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.get_users = async (req, res) => {
  try {
    const users = await getAllUsers();
    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    res.status(200).json({
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.googleSignin = async (req, res) => {
  try {
    const { token } = req.body; // Google ID token from frontend

    // 1. Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;

    // 2. Check if user exists
    let user = await findUserByEmail(email);

    // 3. If not, create new user with Google ID
    if (!user) {
      user = await createUser({
        user_id: `google-${googleId}`,
        user_name: name,
        user_email: email,
        user_number: 0,
        password: null, // no password for Google accounts
      });

      // Update google_id column
      await pool.query(`UPDATE users SET google_id = $1 WHERE id = $2`, [
        googleId,
        user.id,
      ]);
    }

    // 4. Create JWT
    const jwtToken = jwt.sign(
      { id: user.id, email: user.user_email },
      process.env.JWT_SECRET || "supersecretkey",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Google Sign in successful",
      token: jwtToken,
      user: {
        id: user.id,
        name: user.user_name,
        email: user.user_email,
      },
    });
  } catch (error) {
    console.error("Google Signin Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.requestPasswordResetCode = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await findUserByEmail(email);
    if (!user) {
      return res
        .status(400)
        .json({ message: "No account found with that email" });
    }

    // Generate a 6-digit code
    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      `UPDATE users SET reset_code = $1, reset_code_expiry = $2 WHERE user_email = $3`,
      [resetCode, expiry, email]
    );

    const transporter = await createTransporter();

    await transporter.sendMail({
      from: `"Support" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Your Password Reset Code",
      html: `<h2>${resetCode}</h2>`,
    });
    res.json({ message: "Reset code sent to email" });
  } catch (error) {
    console.error("Request Reset Code Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    const result = await pool.query(
      `SELECT reset_code, reset_code_expiry FROM users WHERE user_email = $1`,
      [email]
    );
    const user = result.rows[0];

    if (!user || !user.reset_code || user.reset_code !== code) {
      return res.status(400).json({ message: "Invalid reset code" });
    }

    if (new Date() > new Date(user.reset_code_expiry)) {
      return res.status(400).json({ message: "Reset code expired" });
    }

    res.json({ message: "Code verified. You can now reset your password" });
  } catch (error) {
    console.error("Verify Reset Code Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.resetPasswordWithCode = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    const result = await pool.query(
      `SELECT reset_code, reset_code_expiry FROM users WHERE user_email = $1`,
      [email]
    );
    const user = result.rows[0];

    if (!user || user.reset_code !== code) {
      return res.status(400).json({ message: "Invalid reset code" });
    }

    if (new Date() > new Date(user.reset_code_expiry)) {
      return res.status(400).json({ message: "Reset code expired" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE users 
       SET password_hash = $1, reset_code = NULL, reset_code_expiry = NULL, updated_at = NOW()
       WHERE user_email = $2`,
      [passwordHash, email]
    );

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset Password With Code Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
