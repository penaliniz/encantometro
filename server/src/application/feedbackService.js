// Contém a lógica de negócio pura, sem se preocupar com HTTP ou Banco.
const feedbackRepository = require('../infrastructure/repositories/feedbackRepository');

class FeedbackService {

    /**
     * Mapeia a entrada bruta para uma categoria de negócio.
     * @param {string} inputRaw - O valor de entrada (ex: "VERYGOOD").
     * @returns {string} A categoria mapeada.
     */
    _mapCategory(inputRaw) {
        // ... (sem alterações aqui) ...
        switch (inputRaw.toUpperCase()) {
            case 'VERYGOOD': return 'Gostei de tudo';
            case 'GOOD':     return 'Ambiente';
            case 'FAIR':     return 'Preço';
            case 'POOR':     return 'Atendimento';
            case 'VERYPOOR': return 'Tempo de Espera';
            default:         return 'Não Definida';
        }
    }

    /**
     * Faz o parsing da string transaction_details.
     * @param {string} detailsString - A string no formato "AAAAMMDD,NSU,PDV,LOJA".
     * @returns {object|null} Um objeto com { data, nsu, pdv, loja } ou null se a string for inválida.
     */
    _parseTransactionDetails(detailsString) {
        if (!detailsString || typeof detailsString !== 'string') {
            return null;
        }
        const parts = detailsString.split(',');
        if (parts.length === 4) {
            return {
                data: parts[0]?.trim() || null,
                nsu: parts[1]?.trim() || null,
                pdv: parts[2]?.trim() || null,
                loja: parts[3]?.trim() || null
            };
        } else {
            console.warn(`[feedbackService] Formato inesperado para transaction_details: "${detailsString}". Esperado 4 partes separadas por vírgula.`);
            // Decide se quer guardar a string original em algum lugar ou apenas retornar null
            // Poderia adicionar um campo "transaction_details_raw" no schema se quisesse guardar a original em caso de falha no parse
            return null; // Retorna null se o formato não for o esperado
        }
    }

    /**
     * Caso de uso: Criar um novo registro de feedback.
     * @param {object} data - Contém pdv_id, input_raw, transaction_details (string).
     * @returns {Promise<object>} O feedback criado.
     */
    async createFeedback(data) {
        const { pdv_id, input_raw, transaction_details } = data; // Recebe a string original

        if (!pdv_id || !input_raw) {
            throw new Error('pdv_id e input_raw são obrigatórios');
        }

        const categoria = this._mapCategory(input_raw);
        const parsedDetails = this._parseTransactionDetails(transaction_details); // Faz o parsing

        const feedbackData = {
            pdv_id,
            input_raw,
            categoria,
            // transaction_details: transaction_details || null, // Removido ou opcional
            transactionData: parsedDetails // Adiciona o objeto resultante do parsing
        };

        const savedFeedback = await feedbackRepository.save(feedbackData);
        console.log('Feedback (com detalhes parseados) salvo no MongoDB:', savedFeedback._id);
        return savedFeedback;
    }

    /**
     * Caso de uso: Listar todos os feedbacks.
     * @returns {Promise<Array<object>>}
     */
    async getAllFeedback() {
        return await feedbackRepository.findAll();
    }
}

// Exporta como singleton
module.exports = new FeedbackService();