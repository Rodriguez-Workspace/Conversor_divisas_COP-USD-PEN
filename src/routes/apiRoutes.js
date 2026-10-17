/**
 * API REST Routes
 */
const express = require('express');
const rateController = require('../controllers/rateController');

const router = express.Router();

// Rutas de API
router.get('/rates', rateController.getRates);
router.get('/health', rateController.getHealth);

module.exports = router;
