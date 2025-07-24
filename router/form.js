const express = require('express');
const FormController = require('../controller/formController');
const { rateLimitMiddleware } = require('../middleware/ratelimit');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

// Apply rate limiting to all form routes
router.use(rateLimitMiddleware);

// Routes
router.post('/', validateRequest, FormController.createForm);
router.get('/', FormController.getForms);
router.get('/:id', FormController.getFormById);

module.exports = router;