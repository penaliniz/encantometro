// src/domain/feedbackTypes.js
// DOMAIN: A lógica de negócio mais pura.
// Define quais são os tipos de feedback válidos.

const ValidFeedbackTypes = ['VERYGOOD', 'GOOD', 'FAIR', 'POOR', 'VERYPOOR'];

/**
 * Verifica se uma string de entrada é um tipo de feedback válido.
 * @param {string} inputType A string recebida (ex: "GOOD")
 * @returns {boolean}
 */
function isValidFeedback(inputType) {
    return ValidFeedbackTypes.includes(inputType);
}

module.exports = {
    isValidFeedback,
    ValidFeedbackTypes
};