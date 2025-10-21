const { createFeedbackProcessor } = require('../src/application/processFeedback');
const { isValidFeedback } = require('../src/domain/feedbackTypes');

// Mock do logWatcher
const mockLogWatcher = {
    setLastFeedback: jest.fn(),
    getIsSaleActive: jest.fn().mockReturnValue(true)
};

describe('Feedback Processor', () => {
    let feedbackProcessor;

    beforeEach(() => {
        jest.clearAllMocks();
        feedbackProcessor = createFeedbackProcessor({ logWatcher: mockLogWatcher });
    });

    describe('createFeedbackProcessor', () => {
        test('deve criar processador com logWatcher válido', () => {
            expect(feedbackProcessor).toBeDefined();
            expect(typeof feedbackProcessor.process).toBe('function');
        });

        test('deve criar processador mesmo sem logWatcher', () => {
            const processorWithoutWatcher = createFeedbackProcessor({});
            expect(processorWithoutWatcher).toBeDefined();
        });
    });

    describe('process method', () => {
        test('deve processar feedback válido durante venda ativa', () => {
            const validFeedback = 'GOOD';
            
            feedbackProcessor.process(validFeedback);
            
            expect(mockLogWatcher.setLastFeedback).toHaveBeenCalledWith(validFeedback);
        });

        test('deve ignorar feedback inválido', () => {
            const invalidFeedback = 'INVALID';
            
            feedbackProcessor.process(invalidFeedback);
            
            // Não deve chamar setLastFeedback para feedback inválido
            expect(mockLogWatcher.setLastFeedback).not.toHaveBeenCalled();
        });

        test('deve processar todos os tipos de feedback válidos', () => {
            const validFeedbacks = ['VERYGOOD', 'GOOD', 'FAIR', 'POOR', 'VERYPOOR'];
            
            validFeedbacks.forEach(feedback => {
                feedbackProcessor.process(feedback);
                expect(mockLogWatcher.setLastFeedback).toHaveBeenCalledWith(feedback);
            });
        });

        test('deve ignorar feedback vazio', () => {
            feedbackProcessor.process('');
            
            expect(mockLogWatcher.setLastFeedback).not.toHaveBeenCalled();
        });

        test('deve ignorar feedback null', () => {
            feedbackProcessor.process(null);
            
            expect(mockLogWatcher.setLastFeedback).not.toHaveBeenCalled();
        });

        test('deve ignorar feedback undefined', () => {
            feedbackProcessor.process(undefined);
            
            expect(mockLogWatcher.setLastFeedback).not.toHaveBeenCalled();
        });

        test('deve ignorar feedback numérico', () => {
            feedbackProcessor.process(123);
            
            expect(mockLogWatcher.setLastFeedback).not.toHaveBeenCalled();
        });

        test('deve ignorar feedback objeto', () => {
            const objectFeedback = { rating: 'GOOD', comment: 'Nice service' };
            
            feedbackProcessor.process(objectFeedback);
            
            expect(mockLogWatcher.setLastFeedback).not.toHaveBeenCalled();
        });

        test('deve processar feedback mesmo quando venda não está ativa', () => {
            mockLogWatcher.getIsSaleActive.mockReturnValue(false);
            
            feedbackProcessor.process('GOOD');
            
            expect(mockLogWatcher.setLastFeedback).toHaveBeenCalledWith('GOOD');
        });

        test('deve propagar erro do logWatcher', () => {
            mockLogWatcher.setLastFeedback.mockImplementation(() => {
                throw new Error('LogWatcher error');
            });
            
            // O erro será propagado pois não há try/catch no código
            expect(() => {
                feedbackProcessor.process('GOOD');
            }).toThrow('LogWatcher error');
        });
    });

    describe('integration with domain validation', () => {
        test('deve usar validação de domínio corretamente', () => {
            expect(isValidFeedback('GOOD')).toBe(true);
            expect(isValidFeedback('INVALID')).toBe(false);
            expect(isValidFeedback('')).toBe(false);
            expect(isValidFeedback(null)).toBe(false);
        });

        test('deve validar feedback antes de processar', () => {
            // O processador valida antes de chamar setLastFeedback
            feedbackProcessor.process('INVALID');
            
            expect(mockLogWatcher.setLastFeedback).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        test('deve lidar com logWatcher undefined', () => {
            const processorWithUndefinedWatcher = createFeedbackProcessor({ logWatcher: undefined });
            
            expect(() => {
                processorWithUndefinedWatcher.process('GOOD');
            }).not.toThrow();
        });

        test('deve lidar com logWatcher sem setLastFeedback', () => {
            const invalidWatcher = { getIsSaleActive: jest.fn() };
            const processorWithInvalidWatcher = createFeedbackProcessor({ logWatcher: invalidWatcher });
            
            expect(() => {
                processorWithInvalidWatcher.process('GOOD');
            }).not.toThrow();
        });

        test('deve lidar com múltiplas chamadas simultâneas', () => {
            const promises = [];
            
            for (let i = 0; i < 10; i++) {
                promises.push(
                    new Promise(resolve => {
                        feedbackProcessor.process(`FEEDBACK_${i}`);
                        resolve();
                    })
                );
            }
            
            return Promise.all(promises).then(() => {
                expect(mockLogWatcher.setLastFeedback).toHaveBeenCalledTimes(10);
            });
        });
    });

    describe('performance', () => {
        test('deve processar feedback rapidamente', () => {
            const startTime = Date.now();
            
            feedbackProcessor.process('GOOD');
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(100); // Deve ser muito rápido
        });

        test('deve lidar com muitos feedbacks sequenciais', () => {
            const startTime = Date.now();
            
            for (let i = 0; i < 1000; i++) {
                feedbackProcessor.process(`FEEDBACK_${i}`);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(1000); // Deve ser rápido mesmo com muitos feedbacks
            expect(mockLogWatcher.setLastFeedback).toHaveBeenCalledTimes(1000);
        });
    });
});
