const FormModel = require("../modules/form");
const { validateFormData, sanitizeFormData } = require("../utils/vaidation");

class FormService {
  static async createForm(formData) {
    const validation = validateFormData(formData);
    if (!validation.isValid) {
      const error = new Error("Validation failed");
      error.statusCode = 400;
      error.details = validation.errors;
      throw error;
    }

    const sanitizedData = sanitizeFormData(formData);
    const { name, phone_number, email, messages } = sanitizedData;

    // Check if form already exists
    const existingForm = await FormModel.findByNameOrPhone(name, phone_number);
    if (existingForm) {
      const error = new Error(
        "Form with this name or phone number already exists"
      );
      error.statusCode = 409;
      throw error;
    }

    const newForm = await FormModel.create({
      name,
      phone_number,
      email,
      messages,
    });
    return newForm;
  }

  static async getAllForms(page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    if (page < 1 || limit < 1 || limit > 100) {
      const error = new Error("Invalid pagination parameters");
      error.statusCode = 400;
      throw error;
    }

    const [forms, total] = await Promise.all([
      FormModel.findAll(limit, offset),
      FormModel.count(),
    ]);

    return {
      forms,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  static async getFormById(id) {
    if (!id || isNaN(id)) {
      const error = new Error("Invalid form ID");
      error.statusCode = 400;
      throw error;
    }

    const form = await FormModel.findById(id);
    if (!form) {
      const error = new Error("Form not found");
      error.statusCode = 404;
      throw error;
    }

    return form;
  }
}

module.exports = FormService;
