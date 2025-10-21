const { refocusPdv, isPdvActive } = require('../src/infrastructure/services/windowService');
const { exec, spawn } = require('child_process');
const activeWin = require('active-win');

// Mock das dependências
jest.mock('child_process');
jest.mock('active-win');
jest.mock('../src/config', () => ({
    pdv_window_title: 'LINX - SV01'
}));

const mockedExec = exec;
const mockedSpawn = spawn;
const mockedActiveWin = activeWin;

describe('Window Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('refocusPdv', () => {
        test('deve executar script PowerShell com título válido', async () => {
            const mockChild = {
                on: jest.fn(),
                kill: jest.fn()
            };
            
            mockedSpawn.mockReturnValue(mockChild as any);
            
            // Simula sucesso
            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'exit') {
                    setTimeout(() => callback(0), 100);
                }
            });

            await expect(refocusPdv()).resolves.toBeUndefined();
            
            expect(mockedSpawn).toHaveBeenCalledWith(
                'powershell.exe',
                expect.arrayContaining(['-NoProfile', '-File']),
                expect.objectContaining({ windowsHide: true })
            );
        });

        test('deve rejeitar com título inválido (vazio)', async () => {
            // Mock CONFIG com título vazio
            jest.doMock('../src/config', () => ({
                pdv_window_title: ''
            }));

            await expect(refocusPdv()).rejects.toThrow('Título do PDV inválido');
        });

        test('deve rejeitar com título inválido (muito longo)', async () => {
            // Mock CONFIG com título muito longo
            jest.doMock('../src/config', () => ({
                pdv_window_title: 'A'.repeat(201)
            }));

            await expect(refocusPdv()).rejects.toThrow('Título do PDV inválido');
        });

        test('deve rejeitar com caracteres inválidos no título', async () => {
            // Mock CONFIG com caracteres inválidos
            jest.doMock('../src/config', () => ({
                pdv_window_title: 'LINX<script>alert("xss")</script>'
            }));

            await expect(refocusPdv()).rejects.toThrow('Título do PDV contém caracteres inválidos');
        });

        test('deve lidar com timeout', async () => {
            const mockChild = {
                on: jest.fn(),
                kill: jest.fn()
            };
            
            mockedSpawn.mockReturnValue(mockChild as any);
            
            // Simula timeout (não chama exit callback)
            mockChild.on.mockImplementation(() => {});

            await expect(refocusPdv()).rejects.toThrow('Timeout ao tentar focar janela do PDV');
            expect(mockChild.kill).toHaveBeenCalled();
        });

        test('deve lidar com erro de spawn', async () => {
            const mockChild = {
                on: jest.fn(),
                kill: jest.fn()
            };
            
            mockedSpawn.mockReturnValue(mockChild as any);
            
            // Simula erro
            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'error') {
                    setTimeout(() => callback(new Error('Spawn error')), 100);
                }
            });

            await expect(refocusPdv()).rejects.toThrow('Spawn error');
        });

        test('deve lidar com código de saída não-zero', async () => {
            const mockChild = {
                on: jest.fn(),
                kill: jest.fn()
            };
            
            mockedSpawn.mockReturnValue(mockChild as any);
            
            // Simula código de saída 1
            mockChild.on.mockImplementation((event, callback) => {
                if (event === 'exit') {
                    setTimeout(() => callback(1), 100);
                }
            });

            await expect(refocusPdv()).rejects.toThrow('Script PowerShell encerrou com código 1');
        });
    });

    describe('isPdvActive', () => {
        test('deve retornar true quando janela ativa contém título do PDV', async () => {
            mockedActiveWin.mockResolvedValue({
                title: 'LINX - SV01 - Venda Ativa',
                owner: { name: 'linx.exe' }
            });

            const result = await isPdvActive();
            expect(result).toBe(true);
        });

        test('deve retornar false quando janela ativa não contém título do PDV', async () => {
            mockedActiveWin.mockResolvedValue({
                title: 'Notepad - Documento',
                owner: { name: 'notepad.exe' }
            });

            const result = await isPdvActive();
            expect(result).toBe(false);
        });

        test('deve retornar false quando activeWin retorna null', async () => {
            mockedActiveWin.mockResolvedValue(null);

            const result = await isPdvActive();
            expect(result).toBe(false);
        });

        test('deve retornar false quando título é undefined', async () => {
            mockedActiveWin.mockResolvedValue({
                title: undefined,
                owner: { name: 'app.exe' }
            });

            const result = await isPdvActive();
            expect(result).toBe(false);
        });

        test('deve retornar false com título vazio no CONFIG', async () => {
            // Mock CONFIG com título vazio
            jest.doMock('../src/config', () => ({
                pdv_window_title: ''
            }));

            const result = await isPdvActive();
            expect(result).toBe(false);
        });

        test('deve retornar false com título muito longo no CONFIG', async () => {
            // Mock CONFIG com título muito longo
            jest.doMock('../src/config', () => ({
                pdv_window_title: 'A'.repeat(201)
            }));

            const result = await isPdvActive();
            expect(result).toBe(false);
        });

        test('deve retornar false com caracteres inválidos no CONFIG', async () => {
            // Mock CONFIG com caracteres inválidos
            jest.doMock('../src/config', () => ({
                pdv_window_title: 'LINX<script>alert("xss")</script>'
            }));

            const result = await isPdvActive();
            expect(result).toBe(false);
        });

        test('deve lidar com erro do activeWin', async () => {
            mockedActiveWin.mockRejectedValue(new Error('ActiveWin error'));

            const result = await isPdvActive();
            expect(result).toBe(false);
        });

        test('deve fazer comparação case-insensitive', async () => {
            mockedActiveWin.mockResolvedValue({
                title: 'linx - sv01 - venda ativa',
                owner: { name: 'linx.exe' }
            });

            const result = await isPdvActive();
            expect(result).toBe(true);
        });

        test('deve fazer comparação parcial do título', async () => {
            mockedActiveWin.mockResolvedValue({
                title: 'Sistema LINX - SV01 - Vendas - Ativo',
                owner: { name: 'linx.exe' }
            });

            const result = await isPdvActive();
            expect(result).toBe(true);
        });
    });

    describe('edge cases', () => {
        test('deve lidar com caracteres especiais válidos no título', async () => {
            // Mock CONFIG com caracteres especiais válidos
            jest.doMock('../src/config', () => ({
                pdv_window_title: 'LINX - SV01 (Loja 123) - Vendas'
            }));

            mockedActiveWin.mockResolvedValue({
                title: 'LINX - SV01 (Loja 123) - Vendas - Ativo',
                owner: { name: 'linx.exe' }
            });

            const result = await isPdvActive();
            expect(result).toBe(true);
        });

        test('deve lidar com múltiplas janelas do mesmo aplicativo', async () => {
            mockedActiveWin.mockResolvedValue({
                title: 'LINX - SV01 - Janela 1',
                owner: { name: 'linx.exe' }
            });

            const result = await isPdvActive();
            expect(result).toBe(true);
        });

        test('deve lidar com título com espaços extras', async () => {
            mockedActiveWin.mockResolvedValue({
                title: '  LINX - SV01  ',
                owner: { name: 'linx.exe' }
            });

            const result = await isPdvActive();
            expect(result).toBe(true);
        });
    });
});