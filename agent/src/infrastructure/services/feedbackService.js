// src/infrastructure/services/feedbackService.js
// INFRASTRUCTURE: Adaptador de Saída (Output Adapter)
// Implementação concreta para enviar dados a uma API.

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const CONFIG = require('../../config');

const RETRIES = Number(process.env.FEEDBACK_RETRIES) || 3;
const TIMEOUT_MS = Number(process.env.FEEDBACK_TIMEOUT_MS) || 5000;
const OUTBOX_DIR = path.resolve(__dirname, '..', '..', '..', 'outbox');
const OUTBOX_FILE = path.join(OUTBOX_DIR, 'failed_feedback.jsonl');

function ensureOutboxDir() {
  try {
    if (!fs.existsSync(OUTBOX_DIR)) fs.mkdirSync(OUTBOX_DIR, { recursive: true });
  } catch (e) { /* ignore */ }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Envia feedback para API remota. Faz retries simples e, em caso de falha,
 * persiste o evento em outbox (JSON Lines) para reprocessamento manual/assíncrono.
 *
 * feedback: { pdv_id, input_raw, ... }
 */
async function send(feedback) {
  if (!feedback || typeof feedback !== 'object') {
    return Promise.reject(new Error('feedback must be an object'));
  }

  const url = String(CONFIG.api_url || process.env.API_URL || '').trim();
  if (!url) return Promise.reject(new Error('API URL not configured (CONFIG.api_url or API_URL env)'));

  // header API key: prefer ENV then CONFIG.api_key
  const apiKey = process.env.API_KEY || CONFIG.api_key || '';

  const headers = {
    'Content-Type': 'application/json'
  };
  if (apiKey) headers['x-api-key'] = apiKey;

  // DEBUG: informações básicas para troubleshooting
  console.info(`[feedbackService] send -> url=${url} pdv_id=${feedback && feedback.pdv_id} retries=${RETRIES} timeout=${TIMEOUT_MS}`);
  console.debug && console.debug('[feedbackService] headers:', headers);

  let lastErr = null;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const resp = await axios.post(url, feedback, { headers, timeout: TIMEOUT_MS });
      console.info(`[feedbackService] attempt ${attempt} success status=${resp.status}`);
      console.debug && console.debug('[feedbackService] response.data:', resp.data);
      return resp.data;
    } catch (err) {
      lastErr = err;
      if (err.response) {
        // servidor respondeu com status (401, 400, 500, ...)
        console.error(`[feedbackService] attempt ${attempt} failed: status=${err.response.status}`, err.response.data);
      } else if (err.request) {
        // requisição foi enviada mas sem resposta
        console.error(`[feedbackService] attempt ${attempt} no response (request sent)`, err.message);
      } else {
        // erro ao preparar a requisição
        console.error(`[feedbackService] attempt ${attempt} error`, err.message);
      }
      // backoff exponential (simple)
      const backoff = 200 * Math.pow(2, attempt - 1);
      await sleep(backoff);
    }
  }

  // after retries, persist to outbox for later inspection
  try {
    ensureOutboxDir();
    const record = {
      timestamp: new Date().toISOString(),
      url,
      // do not include raw sensitive payloads in logs; persist as-is to outbox for retrying
      feedback
    };
    fs.appendFileSync(OUTBOX_FILE, JSON.stringify(record) + '\n', { encoding: 'utf8' });
  } catch (e) {
    // swallow to avoid throwing additional errors
  }

  return Promise.reject(lastErr || new Error('Failed to send feedback'));
}

module.exports = { send };