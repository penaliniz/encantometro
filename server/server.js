const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Middlewares de Segurança (sem alterações)
function requireApiKey(req, res, next) {
    const expected = process.env.API_KEY;
    const provided = req.header('x-api-key');
    if (!expected) { console.error('[server] API_KEY not configured.'); return res.status(503).json({ error: 'Server misconfigured' }); }
    if (!provided || provided !== expected) { return res.status(401).json({ error: 'Unauthorized' }); }
    next();
}

const _rateMap = new Map();
const RATE_WINDOW = Number(process.env.RATE_WINDOW_MS) || 60_000;
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX) || 60;

function rateLimiter(req, res, next) {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = _rateMap.get(key);
    if (!entry || now - entry.startAt > RATE_WINDOW) { _rateMap.set(key, { count: 1, startAt: now }); return next(); }
    entry.count += 1;
    if (entry.count > RATE_MAX) { return res.status(429).json({ error: 'Too Many Requests' }); }
    return next();
}

// --- ARMAZENAMENTO EM MEMÓRIA ---
let feedbackDatabase = []; // Array para guardar os feedbacks
let nextId = 1; // Contador para IDs simples
// -----------------------------

// Endpoint POST /api/feedback - MODIFICADO para aceitar transaction_details
app.post('/api/feedback', requireApiKey, rateLimiter, (req, res) => {
    // --- ALTERADO: Extrai transaction_details ---
    const { pdv_id, input_raw, transaction_details } = req.body;
    // ------------------------------------------

    if (!pdv_id || !input_raw) {
        return res.status(400).json({ error: 'pdv_id e input_raw são obrigatórios' });
    }

    // Mapeamento de categoria (sem alterações)
    let categoria = 'Não Definida';
    switch (input_raw.toUpperCase()) {
        case 'VERYGOOD': categoria = 'Gostei de tudo'; break;
        case 'GOOD':     categoria = 'Ambiente'; break;
        case 'FAIR':     categoria = 'Preço'; break;
        case 'POOR':     categoria = 'Atendimento'; break;
        case 'VERYPOOR': categoria = 'Tempo de Espera'; break;
    }

    // --- ALTERADO: Cria objeto incluindo transaction_details ---
    const newFeedback = {
        id: nextId++, // Usa o contador simples
        timestamp: new Date().toISOString(),
        pdv_id: pdv_id,
        input_raw: input_raw,
        categoria: categoria,
        transaction_details: transaction_details || null // Adiciona o novo campo (ou null se não vier)
    };
    // --------------------------------------------------------

    feedbackDatabase.push(newFeedback); // Adiciona ao array em memória

    console.log('Feedback recebido e armazenado (em memória):', newFeedback);

    res.status(201).json({ message: 'Feedback recebido com sucesso!', data: newFeedback });
});

// Endpoint GET /api/feedback (sem alterações, já retorna o array completo)
app.get('/api/feedback', (req, res) => {
    res.json(feedbackDatabase);
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log('--- Servidor de Feedback Iniciado (armazenamento em memória) ---');
    console.log(`API rodando na porta ${PORT}`);
    console.log(`Endpoint de recebimento: http://localhost:${PORT}/api/feedback (POST)`);
    console.log(`Endpoint de visualização: http://localhost:${PORT}/api/feedback (GET)`);
});