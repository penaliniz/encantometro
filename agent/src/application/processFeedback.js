// src/application/processFeedback.js
// APPLICATION: Caso de Uso (Use Case)
// Orquestra a lógica de negócio, independente da infraestrutura.

const { isValidFeedback } = require('../domain/feedbackTypes');
const { requestRefocus } = require('../infrastructure/services/requestRefocus');
const CONFIG = require('../config'); // <-- IMPORTAR A CONFIGURAÇÃO

/**
 * Cria uma instância do processador de feedback.
 * @param {object} services - Serviços de infraestrutura injetados
 * @param {object} services.feedbackService - O serviço que envia o feedback (ex: API)
 * @param {object} services.windowService - O serviço que foca a janela (ex: OS)
 * @returns {object} - Contém o método `process`
 */
function createFeedbackProcessor(services) {
    const { feedbackService, windowService } = services;

    if (!feedbackService || !windowService) {
        throw new Error("createFeedbackProcessor requer 'feedbackService' e 'windowService'.");
    }

    /**
     * Processa uma palavra de entrada recebida do listener.
     * @param {string} word A palavra capturada (ex: "VERYGOOD")
     */
    async function process(word) {
        console.log(`\n[${new Date().toISOString()}] Processando palavra: "${word}"`);

        // 1. Validar a palavra (ex: "VERYGOOD")
        if (isValidFeedback(word)) {
            console.log(`[SUCESSO] Feedback válido encontrado: ${word}`);

            // 2. MONTAR O PAYLOAD (objeto) que a API espera
            const payload = {
                pdv_id: CONFIG.pdv_id, // Vem do config.json
                input_raw: word
            };

            try {
                // 3. Chama o serviço de feedback (abstraído) com o OBJETO
                await feedbackService.send(payload);

                // 4. Chama o serviço de janela via fila/coalescer (TEMPORARIAMENTE DESATIVADO)
                setTimeout(() => {
                    console.log(`[DEBUG] ProcessFeedback: Prestes a chamar requestRefocus... (CHAMADA DESATIVADA PARA TESTE)`); // Log ajustado

                    // --- CHAMADA requestRefocus COMENTADA ---
                    // requestRefocus()
                    //   .then(() => {
                    //       console.log(`[DEBUG] ProcessFeedback: requestRefocus concluído com sucesso.`);
                    //   })
                    //   .catch((err) => {
                    //       console.error(`[FALHA] requestRefocus erro: ${err && err.message}`);
                    //   });
                    // --- FIM DO COMENTÁRIO ---

                    console.log('[DEBUG] ProcessFeedback: Chamada a requestRefocus pulada para teste.');

                }, 150); // Delay original mantido

            } catch (error) {
                // O feedbackService já loga o erro
                console.error(`[FALHA] Erro no processamento do feedback: ${error.message}`);
            }
        } else {
            console.log(`[AVISO] Palavra ignorada, não é um feedback válido: "${word}"`);
        }
    }

    return { process };
}

module.exports = { createFeedbackProcessor };