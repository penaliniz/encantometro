// Movido de server.js para um arquivo próprio (Single Responsibility)

// Middleware de Chave de API
function requireApiKey(req, res, next) {
    const expected = process.env.API_KEY;
    const provided = req.header('x-api-key');
    if (!expected) { 
        console.error('[server] API_KEY not configured.'); 
        return res.status(503).json({ error: 'Server misconfigured' }); 
    }
    if (!provided || provided !== expected) { 
        return res.status(401).json({ error: 'Unauthorized' }); 
    }
    next();
}

// Middleware de Rate Limit (em memória)
const _rateMap = new Map();
const RATE_WINDOW = Number(process.env.RATE_WINDOW_MS) || 60_000;
const RATE_MAX = Number(process.env.RATE_LIMIT_MAX) || 60;

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

module.exports = {
    requireApiKey,
    rateLimiter
};