const { isValidFeedback } = require('../src/domain/feedbackTypes');

describe('feedbackTypes.isValidFeedback', () => {
  test('retorna true para palavra válida', () => {
    expect(isValidFeedback('GOOD')).toBeTruthy();
  });

  test('retorna false para palavra vazia', () => {
    expect(isValidFeedback('')).toBeFalsy();
  });

  test('retorna false para valores não string', () => {
    expect(isValidFeedback(null)).toBeFalsy();
    expect(isValidFeedback(123)).toBeFalsy();
  });
});