// src/application/processFeedback.js
// APPLICATION: Caso de Uso (Use Case)
// Orquestra a lógica de negócio, independente da infraestrutura.

const { isValidFeedback } = require('../domain/feedbackTypes');
const { requestRefocus } = require('../infrastructure/services/requestRefocus');

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

        if (isValidFeedback(word)) {
            console.log(`[SUCESSO] Feedback válido encontrado: ${word}`);
            try {
                // 1. Chama o serviço de feedback (abstraído)
                await feedbackService.send(word);
                
                // 2. Chama o serviço de janela via fila/coalescer
                // Mantemos a chamada assíncrona com tratamento de erro não bloqueante
                setTimeout(() => {
                    requestRefocus().catch((err) => {
                        console.error(`[FALHA] requestRefocus erro: ${err && err.message}`);
                    });
                }, 150); // Delay original mantido

            } catch (error) {
                // O feedbackService já loga o erro, mas poderíamos
                // adicionar uma lógica de retry aqui, se necessário.
                console.error(`[FALHA] Erro no processamento do feedback: ${error.message}`);
            }
        } else {
            console.log(`[AVISO] Palavra ignorada, não é um feedback válido: "${word}"`);
        }
    }

    return { process };
}

module.exports = { createFeedbackProcessor };