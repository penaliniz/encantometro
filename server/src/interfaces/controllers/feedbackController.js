// Responsável por traduzir requisições HTTP para chamadas de serviço.
const feedbackService = require('../../application/feedbackService');

class FeedbackController {
    
    /**
     * Lida com a requisição POST /api/feedback
     */
    async create(req, res) {
        try {
            const { pdv_id, input_raw, transaction_details } = req.body;
            
            // Validação de entrada (rápida)
            if (!pdv_id || !input_raw) {
                return res.status(400).json({ error: 'pdv_id e input_raw são obrigatórios' });
            }

            const feedbackData = { pdv_id, input_raw, transaction_details };
            const newFeedback = await feedbackService.createFeedback(feedbackData);

            res.status(201).json({ message: 'Feedback recebido com sucesso!', data: newFeedback });

        } catch (error) {
            // Se for um erro de validação do Mongoose
            if (error.name === 'ValidationError') {
                return res.status(400).json({ error: error.message });
            }
            // Outros erros (ex: falha de serviço)
            console.error('[feedbackController] Erro ao criar feedback:', error.message);
            res.status(500).json({ error: 'Erro interno ao processar feedback' });
        }
    }

    /**
     * Lida com a requisição GET /api/feedback
     */
    async list(req, res) {
        try {
            const feedbacks = await feedbackService.getAllFeedback();
            res.status(200).json(feedbacks);
        } catch (error) {
            console.error('[feedbackController] Erro ao listar feedbacks:', error.message);
            res.status(500).json({ error: 'Erro interno ao listar feedbacks' });
        }
    }
}

// Exporta como singleton
module.exports = new FeedbackController();