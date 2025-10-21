// Define a estrutura (Schema) dos dados de feedback no banco.
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now
    },
    pdv_id: {
        type: String,
        required: [true, 'pdv_id é obrigatório'],
        trim: true
    },
    input_raw: {
        type: String,
        required: [true, 'input_raw é obrigatório'],
        trim: true
    },
    categoria: {
        type: String,
        required: true
    },
    // transaction_details: { // Removido ou comentado
    //     type: String,
    //     default: null
    // },
    // Novos campos para os detalhes da transação
    transactionData: { // Usamos um subdocumento para agrupar
        data: { type: String, trim: true, default: null }, // AAAAMMDD
        nsu: { type: String, trim: true, default: null },   // Número Sequencial Único
        pdv: { type: String, trim: true, default: null },   // Identificador do Ponto de Venda
        loja: { type: String, trim: true, default: null }  // Identificador da Loja
    }
});

// Cria índices para consultas mais rápidas
feedbackSchema.index({ pdv_id: 1, timestamp: -1 });
feedbackSchema.index({ 'transactionData.data': 1 }); // Índice na data da transação

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;