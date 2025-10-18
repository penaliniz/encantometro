const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middlewares para aceitar requisições de outras origens (CORS) e para entender JSON
app.use(cors());
app.use(express.json());

/**
 * SECURITY MIDDLEWARE
 * - requireApiKey: exige header 'x-api-key' igual a process.env.API_KEY
 * - rateLimiter: limitador simples por IP (configurável via env)
 */
function requireApiKey(req, res, next) {
    const expected = process.env.API_KEY;
    const provided = req.header('x-api-key');

    if (!expected) {
        console.error('[server] API_KEY is not configured in environment. Rejecting protected requests.');
        return res.status(503).json({ error: 'Server misconfigured' });
    }

    if (!provided || provided !== expected) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

const _rateMap = new Map(); // ip => { count, startAt }
const RATE_WINDOW = Number(process.env.RATE_WINDOW_MS) || 60_000; // default 60s
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX) || 60; // default 60 requests per window

function rateLimiter(req, res, next) {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = _rateMap.get(key);

    if (!entry || now - entry.startAt > RATE_WINDOW) {
        _rateMap.set(key, { count: 1, startAt: now });
        return next();
    }

    entry.count += 1;
    if (entry.count > RATE_MAX) {
        return res.status(429).json({ error: 'Too Many Requests' });
    }

    return next();
}

// Banco de dados em memória (para fins de demonstração)
let feedbackDatabase = [];
let nextId = 1;

// Endpoint para receber os dados do agente
app.post('/api/feedback', requireApiKey, rateLimiter, (req, res) => {
    const { pdv_id, input_raw } = req.body;

    if (!pdv_id || !input_raw) {
        return res.status(400).json({ error: 'pdv_id e input_raw são obrigatórios' });
    }

    let categoria = 'Não Definida';
    switch (input_raw.toUpperCase()) {
        case 'VERYGOOD': categoria = 'Gostei de tudo'; break;
        case 'GOOD': categoria = 'Ambiente'; break;
        case 'FAIR': categoria = 'Preço'; break;
        case 'POOR': categoria = 'Atendimento'; break;
        case 'VERYPOOR': categoria = 'Tempo de Espera'; break;
    }

    const newFeedback = {
        id: nextId++,
        timestamp: new Date().toISOString(),
        pdv_id: pdv_id,
        input_raw: input_raw,
        categoria: categoria
    };

    feedbackDatabase.push(newFeedback);

    console.log('Feedback recebido e armazenado:', newFeedback);

    res.status(201).json({ message: 'Feedback recebido com sucesso!', data: newFeedback });
});

// Endpoint para visualizar todos os feedbacks armazenados
app.get('/api/feedback', (req, res) => {
    res.json(feedbackDatabase);
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log('--- Servidor de Feedback Iniciado ---');
    console.log(`API rodando na porta ${PORT}`);
    console.log(`Endpoint de recebimento: http://localhost:${PORT}/api/feedback (POST)`);
    console.log(`Endpoint de visualização: http://localhost:${PORT}/api/feedback (GET)`);
});