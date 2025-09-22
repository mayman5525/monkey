const pool = require('../modules/db');

const adminMiddleware = async (req, res, next) => {
  try {
    const userRes = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0 || !userRes.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = adminMiddleware;