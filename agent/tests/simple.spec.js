const { isValidFeedback } = require('../src/domain/feedbackTypes');

describe('Feedback Types - Simple Test', () => {
    test('deve validar feedback válido', () => {
        expect(isValidFeedback('GOOD')).toBe(true);
    });

    test('deve rejeitar feedback inválido', () => {
        expect(isValidFeedback('INVALID')).toBe(false);
    });

    test('deve rejeitar feedback vazio', () => {
        expect(isValidFeedback('')).toBe(false);
    });

    test('deve rejeitar feedback null', () => {
        expect(isValidFeedback(null)).toBe(false);
    });
});
