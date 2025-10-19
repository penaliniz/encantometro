// src/application/processFeedback.js
const { isValidFeedback } = require('../domain/feedbackTypes');

/**
 * Cria uma instância do processador de feedback.
 * @param {object} dependencies - Dependências injetadas
 * @param {object} dependencies.logWatcher - O serviço que monitora o log e guarda o estado
 */
function createFeedbackProcessor(dependencies) {
    const { logWatcher } = dependencies; // Recebe o logWatcher

    if (!logWatcher || typeof logWatcher.setLastFeedback !== 'function') {
        throw new Error("createFeedbackProcessor requer 'logWatcher' com a função 'setLastFeedback'.");
    }

    /**
     * Processa uma palavra de entrada recebida do listener.
     * APENAS ARMAZENA o feedback se uma venda estiver ativa.
     * @param {string} word A palavra capturada (ex: "VERYGOOD")
     */
    async function process(word) {
        console.log(`\n[${new Date().toISOString()}] Processando palavra recebida: "${word}"`);

        if (isValidFeedback(word)) {
            // Chama a função do logWatcher para armazenar o feedback
            // A própria função logWatcher verificará se a venda está ativa
            logWatcher.setLastFeedback(word);
        } else {
            console.log(`[AVISO] Palavra ignorada, não é um feedback válido: "${word}"`);
        }
    }

    return { process };
}

module.exports = { createFeedbackProcessor };