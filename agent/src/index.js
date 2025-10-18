// src/index.js

// Manipuladores de erro/saída (MANTENHA ESTE BLOCO NO TOPO)
process.on('uncaughtException', (error, origin) => {
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.error('!!!      ERRO NÃO TRATADO (CRASH)        !!!');
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.error('Origem:', origin);
  console.error('Erro:', error);
  console.error('Stack Trace:', error.stack);
  console.error('----------------------------------------------');
  process.exit(1); // Força a saída após logar
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('!!! REJEIÇÃO DE PROMISE NÃO TRATADA      !!!');
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('Promise:', promise);
    console.error('Motivo:', reason);
    console.error('----------------------------------------------');
});

process.on('exit', (code) => {
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.log(`!!!    PROCESSO A SAIR COM CÓDIGO: ${code}     !!!`);
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
});

process.on('SIGINT', () => {
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.log('!!!       RECEBIDO SIGINT (Ctrl+C)         !!!');
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
   process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.log('!!!           RECEBIDO SIGTERM              !!!');
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  process.exit(0);
});
// --- FIM DOS HANDLERS ---

// ENTRYPOINT: Ponto de entrada da aplicação (Composition Root)
const feedbackService = require('./infrastructure/services/feedbackService');
const windowService = require('./infrastructure/services/windowService');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const CONFIG = require('./config');
const { createKeyboardListener } = require('./infrastructure/listeners/keyboardListener');
const { createFeedbackProcessor } = require('./application/processFeedback');

const feedbackProcessor = createFeedbackProcessor({
    feedbackService,
    windowService
});

console.log(`[agent] starting - pid=${process.pid} env=${process.env.NODE_ENV || 'dev'}`);

const consentFile = path.resolve(__dirname, '..', 'consent.log');

async function askConsentIfNeeded() {
  // A implementação desta função permanece a mesma
  if (!CONFIG.enable_keyboard_listener) {
    console.log('[agent] keyboard listener disabled by configuration.');
    return false;
  }
  try {
    const existing = fs.readFileSync(consentFile, 'utf8').trim();
    if (existing.split('\n')[0] === 'consent=granted') {
      console.log('[agent] consent previously granted (consent.log). Starting listener.');
      return true;
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
        console.warn('[agent] Error reading consent file:', e.message);
    }
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => {
    rl.question('Keyboard listener is enabled in config. Grant runtime consent to start it? (y/N): ', (ans) => {
      rl.close();
      res(ans.trim().toLowerCase());
    });
  });

  if (answer === 'y' || answer === 'yes') {
    try {
      fs.writeFileSync(consentFile, `consent=granted\ntimestamp=${new Date().toISOString()}\n`, { flag: 'w', encoding: 'utf8' });
      console.log('[agent] consent recorded.');
    } catch (e) {
      console.warn('[agent] failed to write consent file:', e.message);
    }
    return true;
  }

  console.log('[agent] consent not granted; keyboard listener will not start.');
  return false;
}

(async () => {
  try {
    const consent = await askConsentIfNeeded();

    // Declara 'listener' antes para ser acessível no callback
    let listener = null;

    listener = createKeyboardListener(async (capturedWord) => { // Usa a variável declarada
      try {
        if (capturedWord) {
          await feedbackProcessor.process(capturedWord);
          // --- LINHAS REMOVIDAS/COMENTADAS ---
          // console.log('[agent] Feedback processado, a parar o listener...');
          // if (listener && typeof listener.stop === 'function') {
          //     listener.stop(); // NÃO PARAR MAIS O LISTENER AQUI
          //     console.log('[agent] Listener parado.');
          // }
          // ------------------------------------
        }
      } catch (err) {
        console.error('[agent] erro ao processar feedback via listener:', err && err.message);
      }
    });

    if (consent) {
      if (listener && typeof listener.start === 'function') { // Verifica se listener foi inicializado
        listener.start();
        console.log('[agent] keyboard listener started.');
      } else {
        console.warn('[agent] listener has no start/stop methods or failed to initialize.');
      }
    }

    // Timer para manter o processo vivo (MANTENHA ESTE)
    console.log('[agent] Adicionado timer para manter o processo ativo.');
    setInterval(() => {}, 1000 * 60 * 60);

  } catch (err) {
    console.error('[agent] startup error:', err && err.message);
    process.exit(1);
  }
})();