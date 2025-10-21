// Implementa a lógica de acesso aos dados, abstraindo o Mongoose.
// (Inversão de Dependência)
const Feedback = require('../../domain/feedbackModel');

class FeedbackRepository {
    /**
     * Salva um novo feedback no banco.
     * @param {object} feedbackData - Os dados do feedback a serem salvos.
     * @returns {Promise<object>} O documento salvo.
     */
    async save(feedbackData) {
        const feedback = new Feedback(feedbackData);
        return await feedback.save();
    }

    /**
     * Lista todos os feedbacks.
     * @returns {Promise<Array<object>>} Uma lista de feedbacks.
     */
    async findAll() {
        // Retorna os mais recentes primeiro
        return await Feedback.find().sort({ timestamp: -1 });
    }
}

// Exporta como singleton
module.exports = new FeedbackRepository();