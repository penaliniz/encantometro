// Define os endpoints da API de feedback.
const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const { requireApiKey, rateLimiter } = require('../middleware/securityMiddleware');

const router = express.Router();

// Aplicamos os middlewares de segurança nas rotas
router.post(
    '/', 
    requireApiKey, 
    rateLimiter, 
    feedbackController.create
);

// Adicionando segurança à rota GET também, pois ela expõe dados.
router.get(
    '/',
    requireApiKey, // Protegendo a listagem
    feedbackController.list
);

module.exports = router;