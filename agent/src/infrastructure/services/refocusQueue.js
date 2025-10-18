// simples queue in-memory; para produção use Bull/Redis
const { refocusPdv } = require('./windowService'); // função que executa o foco (pode usar active-win/setForeground via ffi)
let pending = false;
let lastRequestAt = 0;
const COALESCE_MS = 500; // agrupa chamadas em 500ms

async function requestRefocus() {
  lastRequestAt = Date.now();
  if (pending) return;
  pending = true;
  // aguarda pequenas janelas para agrupar solicitações
  while (Date.now() - lastRequestAt < COALESCE_MS) {
    await new Promise((r) => setTimeout(r, 50));
  }
  try {
    await refocusPdv();
  } catch (e) {
    // log/metrics
  } finally {
    pending = false;
  }
}

module.exports = { requestRefocus };