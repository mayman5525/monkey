const {
  createFormService,
  getAllFormsService,
} = require('../services/form.service');
const pool = require('../db');

const createForm = async (req, res) => {
  try {
    const { name, phone_number, email } = req.body;

    if (!name || !phone_number) {
      return res.status(400).json({ message: 'name and phone_number are required' });
    }

    // ✅ Inline check inside the same API
    const checkQuery = 'SELECT * FROM forms WHERE name = $1 OR phone_number = $2';
    const checkResult = await pool.query(checkQuery, [name, phone_number]);

    if (checkResult.rows.length > 0) {
      return res.status(409).json({
        message: 'User with this name or phone number already exists',
      });
    }

    // Insert new form if no duplicate
    const insertQuery = `
      INSERT INTO forms (name, phone_number, email)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const insertResult = await pool.query(insertQuery, [name, phone_number, email]);

    res.status(201).json(insertResult.rows[0]);
  } catch (error) {
    console.error('Error creating form:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getForms = async (req, res) => {
  try {
    const forms = await getAllFormsService();
    res.status(200).json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  createForm,
  getForms,
};
