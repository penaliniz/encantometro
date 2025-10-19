// src/index.js

// Handlers de erro/saída no topo (sem alterações)
process.on('uncaughtException', (error, origin) => { console.error('ERRO NÃO TRATADO:', error, origin); process.exit(1); });
process.on('unhandledRejection', (reason, promise) => { console.error('REJEIÇÃO NÃO TRATADA:', reason, promise); });
process.on('exit', (code) => { console.log(`PROCESSO SAINDO COM CÓDIGO: ${code}`); });
process.on('SIGINT', () => { console.log('RECEBIDO SIGINT'); process.exit(0); });
process.on('SIGTERM', () => { console.log('RECEBIDO SIGTERM'); process.exit(0); });

// 1. Imports
const feedbackService = require('./infrastructure/services/feedbackService');
const windowService = require('./infrastructure/services/windowService'); // Mantido
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const CONFIG = require('./config');
const { createKeyboardListener } = require('./infrastructure/listeners/keyboardListener');
const { createFeedbackProcessor } = require('./application/processFeedback');
const { startWatching } = require('./infrastructure/logWatcher'); // Importa o watcher
const { requestRefocus } = require('./infrastructure/services/requestRefocus'); // Importa refocus

console.log(`[agent] starting - pid=${process.pid} env=${process.env.NODE_ENV || 'dev'}`);
const consentFile = path.resolve(__dirname, '..', 'consent.log');

// Função askConsentIfNeeded (sem alterações lógicas significativas)
async function askConsentIfNeeded() {
    if (!CONFIG.enable_keyboard_listener) { console.log('[agent] keyboard listener disabled by configuration.'); return false; }
    try { if (fs.readFileSync(consentFile, 'utf8').trim().split('\n')[0] === 'consent=granted') { console.log('[agent] consent previously granted.'); return true; }}
    catch (e) { if (e.code !== 'ENOENT') console.warn('[agent] Error reading consent file:', e.message); }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((res)=> rl.question('Grant runtime consent for keyboard listener? (y/N): ', (ans)=>{ rl.close(); res(ans.trim().toLowerCase()); }));
    if(answer==='y'||answer==='yes'){ try { fs.writeFileSync(consentFile, `consent=granted\ntimestamp=${new Date().toISOString()}\n`); console.log('[agent] consent recorded.'); return true; } catch(e){ console.warn('[agent] failed write consent:', e.message); return true; }}
    console.log('[agent] consent not granted.'); return false;
}

(async () => {
  try {
    const consent = await askConsentIfNeeded();

    // Callback quando a linha de início de venda é detectada
    const handleSaleStart = () => {
        console.log("[agent] Venda Iniciada. Preparado para receber feedback.");
    };

    // Callback quando a linha de fim de venda é detectada
    const handleSaleEnd = async (feedbackReceived, transactionData) => {
        console.log(`[agent] Venda Finalizada. Feedback: ${feedbackReceived || 'Nenhum'}, Dados Transação: ${transactionData || 'Nenhum'}`);

        if (feedbackReceived) {
            console.log(`[agent] Enviando feedback "${feedbackReceived}" com dados da transação para a API...`);
            const payload = {
                pdv_id: CONFIG.pdv_id,
                input_raw: feedbackReceived,
                transaction_details: transactionData // Inclui os dados extraídos
            };
            try {
                await feedbackService.send(payload); // Envia o payload completo
                console.log("[agent] Feedback e dados enviados com sucesso.");

                // Chama o refocus APÓS o envio (se necessário)
                 // console.log("[agent] Chamando refocus..."); // Descomente se quiser reativar
                 // setTimeout(() => {
                 //    requestRefocus().catch((err) => {
                 //        console.error(`[FALHA] requestRefocus erro pós-venda: ${err && err.message}`);
                 //    });
                 // }, 300);

            } catch (error) {
                console.error(`[FALHA] Erro ao enviar feedback/dados após fim da venda: ${error.message}`);
            }
        } else {
             console.log("[agent] Nenhuma avaliação recebida durante a venda. Nada a enviar.");
             // Considerar se deve chamar refocus mesmo sem feedback
        }
    };

    // Inicia o Log Watcher e passa os callbacks
    const logWatcher = startWatching({
        onSaleStart: handleSaleStart,
        onSaleEnd: handleSaleEnd
    });

    // Cria o processador de feedback, injetando o logWatcher
     const feedbackProcessor = createFeedbackProcessor({ logWatcher });

    // Cria o listener do teclado, passando a função process e a instância do watcher
    const listener = createKeyboardListener(feedbackProcessor.process, logWatcher);

    if (consent) {
      if (listener && typeof listener.start === 'function') {
        listener.start();
        console.log('[agent] keyboard listener started.');
      } else {
        console.warn('[agent] listener failed to initialize properly.');
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