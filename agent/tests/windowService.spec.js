jest.mock('active-win', () => jest.fn());

const activeWin = require('active-win');
const { isPdvActive } = require('../src/infrastructure/services/windowService');
const CONFIG = require('../src/config');

describe('windowService.isPdvActive', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('retorna true quando título ativo contém pdv_window_title', async () => {
    CONFIG.pdv_window_title = 'Meu PDV';
    activeWin.mockResolvedValueOnce({ title: 'Meu PDV - Caixa 1' });

    const result = await isPdvActive();
    expect(result).toBe(true);
  });

  test('retorna false quando título ativo não contém pdv_window_title', async () => {
    CONFIG.pdv_window_title = 'PDV-Alvo';
    activeWin.mockResolvedValueOnce({ title: 'Outro Programa - Janela' });

    const result = await isPdvActive();
    expect(result).toBe(false);
  });

  test('retorna false em caso de erro/undefined', async () => {
    CONFIG.pdv_window_title = 'Meu PDV';
    activeWin.mockRejectedValueOnce(new Error('fail'));
    const result = await isPdvActive();
    expect(result).toBe(false);
  });
});
