// controllers/form.controller.js
const {
  createForm,
  getForms,
  
} = require('../services/formService');

const createForm = async (req, res) => {
  try {
    const { name, phone_number, email } = req.body;

    if (!name || !phone_number) {
      return res.status(400).json({ message: 'name and phone_number are required' });
    }

    // ✅ Check for existing user by name or phone number
    const exists = await formExists({ name, phone_number });
    if (exists) {
      return res.status(409).json({ message: 'Form with this name or phone number already exists' });
    }

    const form = await createFormService({ name, phone_number, email });
    res.status(201).json(form);
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