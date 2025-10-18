const { refocusPdv } = require('./windowService');

let pending = false;
let lastRequestAt = 0;
const COALESCE_MS = Number(process.env.REFOCUS_COALESCE_MS) || 500; // agrupa chamadas em 500ms

async function requestRefocus() {
  lastRequestAt = Date.now();
  if (pending) return; // já em processamento, só atualiza timestamp para coalescer
  pending = true;

  // aguarda janela de coalescência para agrupar múltiplas requisições rápidas
  while (Date.now() - lastRequestAt < COALESCE_MS) {
    // pequeno sleep
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 50));
  }

  try {
    await refocusPdv();
  } catch (e) {
    // manter log mínimo, sem dados sensíveis
    console.error('[requestRefocus] erro ao tentar refocus:', e && e.message);
  } finally {
    pending = false;
  }
}

module.exports = { requestRefocus };