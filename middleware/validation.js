const { validateFormData } = require('../utils/vaidation');

function validateRequest(req, res, next) {
  const validation = validateFormData(req.body);
  
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      details: validation.errors
    });
  }
  
  next();
}

module.exports = {
  validateRequest
};
