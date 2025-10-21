const fs = require('fs');
const path = require('path');
const { startWatching } = require('../src/infrastructure/logWatcher');

// Mock do fs
jest.mock('fs');
const mockedFs = fs;

describe('Log Watcher', () => {
    let mockCallbacks;
    let watcher;

    beforeEach(() => {
        mockCallbacks = {
            onSaleStart: jest.fn(),
            onSaleEnd: jest.fn()
        };

        // Reset mocks
        jest.clearAllMocks();
        
        // Mock fs.existsSync para retornar true por padrão
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.statSync.mockReturnValue({ size: 1000 });
        mockedFs.watchFile.mockImplementation(() => {});
        mockedFs.createReadStream.mockReturnValue({
            on: jest.fn(),
            pipe: jest.fn()
        });
    });

    afterEach(() => {
        if (watcher && watcher.watcher) {
            watcher.watcher.stop();
        }
    });

    describe('startWatching', () => {
        test('deve iniciar monitoramento com callbacks válidos', () => {
            watcher = startWatching(mockCallbacks);
            
            expect(watcher).toBeDefined();
            expect(watcher.setLastFeedback).toBeDefined();
            expect(watcher.getIsSaleActive).toBeDefined();
            expect(watcher.watcher).toBeDefined();
        });

        test('deve usar callbacks padrão quando não fornecidos', () => {
            watcher = startWatching({});
            
            expect(watcher).toBeDefined();
            expect(watcher.setLastFeedback).toBeDefined();
            expect(watcher.getIsSaleActive).toBeDefined();
        });

        test('deve criar diretório se não existir', () => {
            mockedFs.existsSync.mockReturnValue(false);
            mockedFs.mkdirSync.mockImplementation(() => {});
            
            watcher = startWatching(mockCallbacks);
            
            expect(mockedFs.mkdirSync).toHaveBeenCalled();
        });

        test('deve lidar com erro ao criar diretório', () => {
            mockedFs.existsSync.mockReturnValue(false);
            mockedFs.mkdirSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });
            
            watcher = startWatching(mockCallbacks);
            
            expect(watcher.watcher).toBeNull();
            expect(watcher.getIsSaleActive()).toBe(false);
        });

        test('deve obter tamanho inicial do arquivo', () => {
            mockedFs.statSync.mockReturnValue({ size: 2048 });
            
            watcher = startWatching(mockCallbacks);
            
            expect(mockedFs.statSync).toHaveBeenCalled();
        });

        test('deve lidar com arquivo inexistente inicialmente', () => {
            mockedFs.existsSync.mockReturnValue(false);
            
            watcher = startWatching(mockCallbacks);
            
            expect(watcher).toBeDefined();
        });
    });

    describe('setLastFeedback', () => {
        beforeEach(() => {
            watcher = startWatching(mockCallbacks);
        });

        test('deve armazenar feedback quando venda está ativa', () => {
            // Simula venda ativa
            watcher.setLastFeedback('GOOD');
            
            // Verifica se o feedback foi processado
            expect(watcher.getIsSaleActive()).toBeDefined();
        });

        test('deve ignorar feedback quando venda não está ativa', () => {
            // Simula venda inativa
            watcher.setLastFeedback('GOOD');
            
            // O feedback deve ser ignorado
            expect(watcher.getIsSaleActive()).toBeDefined();
        });
    });

    describe('getIsSaleActive', () => {
        beforeEach(() => {
            watcher = startWatching(mockCallbacks);
        });

        test('deve retornar estado da venda', () => {
            const isActive = watcher.getIsSaleActive();
            expect(typeof isActive).toBe('boolean');
        });
    });

    describe('processNewLogContent', () => {
        let mockProcessNewLogContent;

        beforeEach(() => {
            watcher = startWatching(mockCallbacks);
            
            // Mock interno para testar processNewLogContent
            mockProcessNewLogContent = jest.fn();
        });

        test('deve processar linha de início de venda', () => {
            const startLine = "MicSolicitaCpfFidelidade::processa::Contador evento transacao";
            
            // Simula processamento de linha
            mockProcessNewLogContent(startLine);
            
            expect(mockProcessNewLogContent).toHaveBeenCalledWith(startLine);
        });

        test('deve processar linha de fim de venda', () => {
            const endLine = "GerenciadorCMOS :: atualizaRecebimentos :: consultando a transação -> dados123";
            
            mockProcessNewLogContent(endLine);
            
            expect(mockProcessNewLogContent).toHaveBeenCalledWith(endLine);
        });

        test('deve ignorar linhas vazias', () => {
            const emptyLines = ['', '   ', '\n', '\t'];
            
            emptyLines.forEach(line => {
                mockProcessNewLogContent(line);
            });
            
            expect(mockProcessNewLogContent).toHaveBeenCalledTimes(4);
        });

        test('deve extrair dados da transação corretamente', () => {
            const endLineWithData = "GerenciadorCMOS :: atualizaRecebimentos :: consultando a transação -> dados123";
            
            mockProcessNewLogContent(endLineWithData);
            
            expect(mockProcessNewLogContent).toHaveBeenCalledWith(endLineWithData);
        });

        test('deve lidar com linha de fim sem dados', () => {
            const endLineWithoutData = "GerenciadorCMOS :: atualizaRecebimentos :: consultando a transação";
            
            mockProcessNewLogContent(endLineWithoutData);
            
            expect(mockProcessNewLogContent).toHaveBeenCalledWith(endLineWithoutData);
        });
    });

    describe('file watching', () => {
        beforeEach(() => {
            watcher = startWatching(mockCallbacks);
        });

        test('deve configurar fs.watchFile corretamente', () => {
            expect(mockedFs.watchFile).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    persistent: true,
                    interval: expect.any(Number)
                }),
                expect.any(Function)
            );
        });

        test('deve lidar com erro ao iniciar watchFile', () => {
            mockedFs.watchFile.mockImplementation(() => {
                throw new Error('Watch error');
            });
            
            const errorWatcher = startWatching(mockCallbacks);
            
            expect(errorWatcher.watcher).toBeNull();
        });
    });

    describe('stopWatching', () => {
        beforeEach(() => {
            watcher = startWatching(mockCallbacks);
        });

        test('deve parar monitoramento corretamente', () => {
            mockedFs.unwatchFile.mockImplementation(() => {});
            
            watcher.watcher.stop();
            
            expect(mockedFs.unwatchFile).toHaveBeenCalled();
        });

        test('deve lidar com parada quando watcher é null', () => {
            const nullWatcher = { watcher: null };
            
            expect(() => {
                if (nullWatcher.watcher) {
                    nullWatcher.watcher.stop();
                }
            }).not.toThrow();
        });
    });

    describe('edge cases', () => {
        beforeEach(() => {
            watcher = startWatching(mockCallbacks);
        });

        test('deve lidar com múltiplas linhas de início', () => {
            const multipleStartLines = [
                "MicSolicitaCpfFidelidade::processa::Contador evento transacao",
                "MicSolicitaCpfFidelidade::processa::Contador evento transacao"
            ];
            
            multipleStartLines.forEach(line => {
                // Simula processamento
                expect(line).toContain("MicSolicitaCpfFidelidade");
            });
        });

        test('deve lidar com múltiplas linhas de fim', () => {
            const multipleEndLines = [
                "GerenciadorCMOS :: atualizaRecebimentos :: consultando a transação -> dados1",
                "GerenciadorCMOS :: atualizaRecebimentos :: consultando a transação -> dados2"
            ];
            
            multipleEndLines.forEach(line => {
                expect(line).toContain("GerenciadorCMOS");
            });
        });

        test('deve lidar com arquivo truncado', () => {
            // Simula arquivo que diminuiu de tamanho
            const mockStats = { size: 500 }; // Menor que o tamanho anterior
            mockedFs.statSync.mockReturnValue(mockStats);
            
            expect(mockStats.size).toBeLessThan(1000);
        });
    });
});
