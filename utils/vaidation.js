const validator = require("validator");

function validateFormData(data) {
  const errors = [];
  const { name, phone_number, email, messages } = data;

  // Name validation
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    errors.push("Name is required and must be a non-empty string");
  } else if (name.trim().length < 2 || name.trim().length > 50) {
    errors.push("Name must be between 2 and 50 characters");
  }

  // Phone number validation
  if (!phone_number || typeof phone_number !== "string") {
    errors.push("Phone number is required and must be a string");
  } else if (!validator.isMobilePhone(phone_number.replace(/\s+/g, ""))) {
    errors.push("Phone number must be a valid mobile phone number");
  }

  // Email validation (optional but must be valid if provided)
  if (email && !validator.isEmail(email)) {
    errors.push("Email must be a valid email address");
  }

  // Messages validation (optional)
  if (messages && typeof messages !== "string") {
    errors.push("Messages must be a string");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function sanitizeFormData(data) {
  return {
    name: data.name ? validator.escape(data.name.trim()) : null,
    phone_number: data.phone_number
      ? data.phone_number.replace(/\s+/g, "")
      : null,
    email: data.email
      ? validator.normalizeEmail(data.email.toLowerCase().trim())
      : null,
    // Add the missing messages field
    messages: data.messages ? validator.escape(data.messages.trim()) : null,
  };
}

module.exports = {
  validateFormData,
  sanitizeFormData,
};