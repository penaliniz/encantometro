// src/index.js
// ENTRYPOINT: Ponto de entrada da aplicação (Composition Root)
// Responsável por "montar" a aplicação, conectando as camadas.

// 1. Importar implementações concretas de infraestrutura
const feedbackService = require('./infrastructure/services/feedbackService');
const windowService = require('./infrastructure/services/windowService');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const CONFIG = require('./config');
const { createKeyboardListener } = require('./infrastructure/listeners/keyboardListener');

// 2. Importar o caso de uso
const { createFeedbackProcessor } = require('./application/processFeedback');

// 3. Injeção de Dependência (DI):
// Cria o "cérebro" (caso de uso) e injeta suas dependências (serviços)
const feedbackProcessor = createFeedbackProcessor({
    feedbackService,
    windowService
});

console.log(`[agent] starting - pid=${process.pid} env=${process.env.NODE_ENV || 'dev'}`);

const consentFile = path.resolve(__dirname, '..', 'consent.log'); // c:\atendimento\consent.log

async function askConsentIfNeeded() {
  if (!CONFIG.enable_keyboard_listener) {
    console.log('[agent] keyboard listener disabled by configuration.');
    return false;
  }

  // se já houver registro de consentimento válido, reutiliza
  try {
    const existing = fs.readFileSync(consentFile, 'utf8').trim();
    if (existing === 'consent=granted') {
      console.log('[agent] consent previously granted (consent.log). Starting listener.');
      return true;
    }
  } catch (e) {
    // file not found -> proceed to interactive consent
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

    const listener = createKeyboardListener(async (meta) => {
      try {
        // meta.key contém a tecla/atalho permitida — enviar para o processador
        if (meta && meta.key) {
          // process espera a "palavra" (string) conforme implementação
          await feedbackProcessor.process(String(meta.key));
        }
      } catch (err) {
        console.error('[agent] erro ao processar feedback via listener:', err && err.message);
      }
    });

    if (consent) {
      // start only when consent true
      if (typeof listener.start === 'function') {
        listener.start();
        console.log('[agent] keyboard listener started.');
      } else {
        console.warn('[agent] listener has no start method; not started.');
      }
    }

    // ...existing code to initialize other services and start main loop...
  } catch (err) {
    console.error('[agent] startup error:', err && err.message);
    process.exit(1);
  }
})();