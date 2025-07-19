const express = require('express')

const router = express.Router()
const formController = require('../controller/formController')

router.post('/form',formController.submitForm())
