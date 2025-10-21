// Setup global para testes
const path = require('path');

// Configuração global de timeout
jest.setTimeout(10000);

// Mock global para console.log em testes
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Suprime logs durante os testes (exceto erros importantes)
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
};

// Restaura console para erros críticos
console.error = originalConsoleError;

// Cleanup após cada teste
afterEach(() => {
    jest.clearAllMocks();
});

// Cleanup global após todos os testes
afterAll(() => {
    // Restaura console original
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
});

// Mock global para process.exit
const originalExit = process.exit;
process.exit = jest.fn();

// Restaura process.exit após testes
afterAll(() => {
    process.exit = originalExit;
});

// Configuração de variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test_api_key_12345';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.RATE_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX = '60';
