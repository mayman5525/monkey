const FormService = require("../services/formService");
const logger = require("../utils/logger");

class FormController {
  static async createForm(req, res) {
    try {
      const formData = req.body;
      const newForm = await FormService.createForm(formData);

      logger.info(`New form created with ID: ${newForm.id}`);
      res.status(201).json({
        success: true,
        message: "Form created successfully",
        data: newForm,
      });
    } catch (error) {
      FormController.handleError(error, res, "Error creating form");
    }
  }

  static async getForms(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;

      const result = await FormService.getAllForms(page, limit);

      res.status(200).json({
        success: true,
        message: "Forms retrieved successfully",
        data: result.forms,
        pagination: result.pagination,
      });
    } catch (error) {
      FormController.handleError(error, res, "Error fetching forms");
    }
  }

  static async getFormById(req, res) {
    try {
      const { id } = req.params;
      const form = await FormService.getFormById(id);

      res.status(200).json({
        success: true,
        message: "Form retrieved successfully",
        data: form,
      });
    } catch (error) {
      FormController.handleError(error, res, "Error fetching form");
    }
  }

  static handleError(error, res, logMessage) {
    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? "Internal server error" : error.message;

    logger.error(`${logMessage}: ${error.message}`, {
      stack: error.stack,
      statusCode,
    });

    const response = {
      success: false,
      message,
    };

    // Include validation details for 400 errors
    if (statusCode === 400 && error.details) {
      response.details = error.details;
    }

    res.status(statusCode).json(response);
  }
}

module.exports = FormController;
