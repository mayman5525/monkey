const express = require('express');
const router = express.Router();
const { createForm, getForms } = require('../controller/formController');

router.post('/', createForm);
router.get('/', getForms);

module.exports = router;
