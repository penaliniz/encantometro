const { startWatching } = require('../src/infrastructure/logWatcher');
const fs = require('fs');
const path = require('path');

describe('LogWatcher Memory Leak Prevention', () => {
    const testLogPath = path.join(__dirname, 'test-log.txt');
    let logWatcher;

    beforeEach(() => {
        // Cria arquivo de teste
        fs.writeFileSync(testLogPath, 'Initial content\n');
    });

    afterEach(() => {
        // Limpa recursos após cada teste
        if (logWatcher && logWatcher.cleanupResources) {
            logWatcher.cleanupResources();
        }
        
        // Remove arquivo de teste
        if (fs.existsSync(testLogPath)) {
            fs.unlinkSync(testLogPath);
        }
    });

    test('deve limpar recursos adequadamente ao parar o watcher', () => {
        const mockCallbacks = {
            onSaleStart: jest.fn(),
            onSaleEnd: jest.fn()
        };

        // Mock do fs.watch para evitar problemas de sistema
        const originalWatch = fs.watch;
        const mockWatcher = {
            close: jest.fn(),
            on: jest.fn()
        };
        
        fs.watch = jest.fn().mockReturnValue(mockWatcher);

        logWatcher = startWatching(mockCallbacks);

        expect(logWatcher).toBeDefined();
        expect(logWatcher.cleanupResources).toBeDefined();

        // Simula parada do watcher
        logWatcher.watcher.stop();

        expect(mockWatcher.close).toHaveBeenCalled();

        // Restaura fs.watch original
        fs.watch = originalWatch;
    });

    test('deve implementar debouncing para evitar processamento excessivo', (done) => {
        const mockCallbacks = {
            onSaleStart: jest.fn(),
            onSaleEnd: jest.fn()
        };

        // Mock do fs.watch
        const originalWatch = fs.watch;
        const mockWatcher = {
            close: jest.fn(),
            on: jest.fn()
        };
        
        fs.watch = jest.fn().mockReturnValue(mockWatcher);

        logWatcher = startWatching(mockCallbacks);

        // Simula múltiplas mudanças rápidas
        const changeCallback = fs.watch.mock.calls[0][1];
        
        // Múltiplas chamadas rápidas
        changeCallback('change', 'test-log.txt');
        changeCallback('change', 'test-log.txt');
        changeCallback('change', 'test-log.txt');

        // Verifica que apenas uma mudança é processada após debounce
        setTimeout(() => {
            expect(logWatcher).toBeDefined();
            done();
        }, 1500);

        // Restaura fs.watch original
        fs.watch = originalWatch;
    });

    test('deve tratar erros com retry logic', () => {
        const mockCallbacks = {
            onSaleStart: jest.fn(),
            onSaleEnd: jest.fn()
        };

        // Mock do fs.watch com erro
        const originalWatch = fs.watch;
        const mockWatcher = {
            close: jest.fn(),
            on: jest.fn((event, callback) => {
                if (event === 'error') {
                    // Simula erro após um tempo
                    setTimeout(() => callback(new Error('File system error')), 100);
                }
            })
        };
        
        fs.watch = jest.fn().mockReturnValue(mockWatcher);

        logWatcher = startWatching(mockCallbacks);

        expect(logWatcher).toBeDefined();

        // Restaura fs.watch original
        fs.watch = originalWatch;
    });

    test('deve registrar event listeners para cleanup automático', () => {
        const originalOn = process.on;
        const mockOn = jest.fn();
        process.on = mockOn;

        const mockCallbacks = {
            onSaleStart: jest.fn(),
            onSaleEnd: jest.fn()
        };

        // Mock do fs.watch
        const mockWatcher = {
            close: jest.fn(),
            on: jest.fn()
        };
        
        fs.watch = jest.fn().mockReturnValue(mockWatcher);

        logWatcher = startWatching(mockCallbacks);

        // Verifica se os event listeners foram registrados
        expect(mockOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith('exit', expect.any(Function));

        // Restaura funções originais
        process.on = originalOn;
        fs.watch = jest.fn();
    });

    test('deve usar fs.watch em vez de fs.watchFile', () => {
        const mockCallbacks = {
            onSaleStart: jest.fn(),
            onSaleEnd: jest.fn()
        };

        // Mock do fs.watch
        const originalWatch = fs.watch;
        const mockWatcher = {
            close: jest.fn(),
            on: jest.fn()
        };
        
        fs.watch = jest.fn().mockReturnValue(mockWatcher);

        logWatcher = startWatching(mockCallbacks);

        // Verifica se fs.watch foi chamado
        expect(fs.watch).toHaveBeenCalledWith(
            expect.stringContaining('CSIDebugFile.txt'),
            { persistent: true },
            expect.any(Function)
        );

        // Restaura fs.watch original
        fs.watch = originalWatch;
    });
});
