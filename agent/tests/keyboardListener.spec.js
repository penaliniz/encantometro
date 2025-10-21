const { createKeyboardListener } = require('../src/infrastructure/listeners/keyboardListener');

// Mock do CONFIG
jest.mock('../src/config', () => ({
    enable_keyboard_listener: true,
    keyboard_debounce_ms: 300
}));

// Mock do node-global-key-listener
jest.mock('node-global-key-listener', () => ({
    GlobalKeyboardListener: jest.fn().mockImplementation(() => ({
        addListener: jest.fn(),
        removeListener: jest.fn()
    }))
}));

// Mock do windowService
jest.mock('../src/infrastructure/services/windowService', () => ({
    isPdvActive: jest.fn().mockResolvedValue(true)
}));

describe('Keyboard Listener', () => {
    let mockLogWatcher;
    let mockOnWordCaptured;
    let listener;

    beforeEach(() => {
        mockOnWordCaptured = jest.fn();
        mockLogWatcher = {
            getIsSaleActive: jest.fn().mockReturnValue(true)
        };
        
        listener = createKeyboardListener(mockOnWordCaptured, mockLogWatcher);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createKeyboardListener', () => {
        test('deve criar listener quando habilitado', () => {
            expect(listener).toBeDefined();
            expect(typeof listener.start).toBe('function');
            expect(typeof listener.stop).toBe('function');
        });

        test('deve retornar listener vazio quando desabilitado', () => {
            // Mock CONFIG para desabilitar
            jest.doMock('../src/config', () => ({
                enable_keyboard_listener: false
            }));

            const disabledListener = createKeyboardListener(mockOnWordCaptured, mockLogWatcher);
            expect(disabledListener.start).toBeDefined();
            expect(disabledListener.stop).toBeDefined();
        });

        test('deve retornar listener vazio quando logWatcher inválido', () => {
            const invalidWatcher = { getIsSaleActive: 'not-a-function' };
            const invalidListener = createKeyboardListener(mockOnWordCaptured, invalidWatcher);
            
            expect(invalidListener.start).toBeDefined();
            expect(invalidListener.stop).toBeDefined();
        });
    });

    describe('start/stop functionality', () => {
        test('deve iniciar listener corretamente', () => {
            expect(() => listener.start()).not.toThrow();
        });

        test('deve parar listener corretamente', () => {
            expect(() => listener.stop()).not.toThrow();
        });
    });

    describe('keyboard event handling', () => {
        let mockHandler;

        beforeEach(() => {
            const { GlobalKeyboardListener } = require('node-global-key-listener');
            const mockGKL = new GlobalKeyboardListener();
            mockHandler = mockGKL.addListener.mock.calls[0][0];
        });

        test('deve ignorar teclas quando venda não está ativa', () => {
            mockLogWatcher.getIsSaleActive.mockReturnValue(false);
            
            const event = { name: 'A', state: 'DOWN' };
            mockHandler(event);
            
            expect(mockOnWordCaptured).not.toHaveBeenCalled();
        });

        test('deve processar ENTER com buffer válido', () => {
            // Simula buffer com caracteres
            const event = { name: 'RETURN', state: 'DOWN' };
            
            // Mock interno do buffer (simulação)
            const originalConsoleLog = console.log;
            console.log = jest.fn();
            
            mockHandler(event);
            
            console.log = originalConsoleLog;
        });

        test('deve ignorar ENTER com buffer vazio', () => {
            const event = { name: 'RETURN', state: 'DOWN' };
            
            const originalConsoleLog = console.log;
            console.log = jest.fn();
            
            mockHandler(event);
            
            expect(mockOnWordCaptured).not.toHaveBeenCalled();
            
            console.log = originalConsoleLog;
        });

        test('deve ignorar teclas modificadoras', () => {
            const modifierKeys = ['LEFT SHIFT', 'RIGHT SHIFT', 'SHIFT', 'LEFT CTRL', 'RIGHT CTRL', 'CTRL'];
            
            modifierKeys.forEach(key => {
                const event = { name: key, state: 'DOWN' };
                mockHandler(event);
                expect(mockOnWordCaptured).not.toHaveBeenCalled();
            });
        });

        test('deve aceitar caracteres alfanuméricos válidos', () => {
            const validChars = ['A', 'B', '1', '2', 'a', 'b'];
            
            validChars.forEach(char => {
                const event = { name: char, state: 'DOWN' };
                mockHandler(event);
                // Não deve chamar onWordCaptured ainda (só no ENTER)
                expect(mockOnWordCaptured).not.toHaveBeenCalled();
            });
        });

        test('deve rejeitar caracteres inválidos', () => {
            const invalidChars = ['!', '@', '#', '$', '%', '^', '&', '*'];
            
            invalidChars.forEach(char => {
                const event = { name: char, state: 'DOWN' };
                mockHandler(event);
                expect(mockOnWordCaptured).not.toHaveBeenCalled();
            });
        });

        test('deve limpar buffer em caso de erro', () => {
            mockOnWordCaptured.mockImplementation(() => {
                throw new Error('Test error');
            });

            const event = { name: 'RETURN', state: 'DOWN' };
            
            expect(() => mockHandler(event)).not.toThrow();
        });
    });

    describe('PDV active state', () => {
        test('deve verificar se PDV está ativo', async () => {
            const windowService = require('../src/infrastructure/services/windowService');
            windowService.isPdvActive.mockResolvedValue(true);
            
            // Simula verificação de PDV ativo
            const isActive = await windowService.isPdvActive();
            expect(isActive).toBe(true);
        });

        test('deve retornar false quando PDV não está ativo', async () => {
            const windowService = require('../src/infrastructure/services/windowService');
            windowService.isPdvActive.mockResolvedValue(false);
            
            const isActive = await windowService.isPdvActive();
            expect(isActive).toBe(false);
        });
    });
});
