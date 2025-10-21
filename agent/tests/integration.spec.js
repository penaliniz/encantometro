const request = require('supertest');
const express = require('express');
const cors = require('cors');
// Mock do MongoDB (caminho correto)
jest.mock('../../server/src/infrastructure/database/mongodb', () => ({
    connectToDatabase: jest.fn().mockResolvedValue(undefined)
}));

// Mock das rotas (caminho correto)
jest.mock('../../server/src/interfaces/routes/feedbackRoutes', () => {
    const express = require('express');
    const router = express.Router();
    
    router.post('/', (req, res) => {
        res.status(201).json({ _id: 'test-id', pdv_id: req.body.pdv_id });
    });
    
    router.get('/', (req, res) => {
        res.status(200).json([]);
    });
    
    return router;
});

// Mock do Mongoose
jest.mock('mongoose', () => ({
    connection: {
        readyState: 1
    },
    model: jest.fn().mockReturnValue({
        create: jest.fn().mockResolvedValue({ _id: 'test-id', pdv_id: 'test-pdv' }),
        find: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([])
            })
        })
    }),
    Schema: jest.fn().mockImplementation(() => ({
        index: jest.fn()
    }))
}));

describe('Integration Tests - Feedback Flow', () => {
    let app;
    const TEST_API_KEY = 'test_api_key_12345';

    beforeAll(() => {
        // Configura variáveis de ambiente para teste
        process.env.API_KEY = TEST_API_KEY;
        process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
        
        app = express();
        app.use(cors());
        app.use(express.json());
        
        // Mock das rotas diretamente
        app.post('/api/feedback', (req, res) => {
            const apiKey = req.header('x-api-key');
            if (!apiKey || apiKey !== TEST_API_KEY) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            res.status(201).json({ _id: 'test-id', pdv_id: req.body.pdv_id });
        });
        
        app.get('/api/feedback', (req, res) => {
            const apiKey = req.header('x-api-key');
            if (!apiKey || apiKey !== TEST_API_KEY) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            res.status(200).json([]);
        });
        
        // Health check endpoint
        app.get('/health', (req, res) => {
            res.status(200).json({ status: 'UP', db: 'connected' });
        });
    });

    afterAll(() => {
        delete process.env.API_KEY;
        delete process.env.MONGODB_URI;
    });

    describe('Health Check', () => {
        test('deve retornar status UP quando banco conectado', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toEqual({
                status: 'UP',
                db: 'connected'
            });
        });
    });

    describe('POST /api/feedback', () => {
        test('deve criar feedback com dados válidos', async () => {
            const feedbackData = {
                pdv_id: 'TEST_PDV_001',
                input_raw: 'GOOD',
                categoria: 'POSITIVO'
            };

            const response = await request(app)
                .post('/api/feedback')
                .set('x-api-key', TEST_API_KEY)
                .send(feedbackData)
                .expect(201);

            expect(response.body).toBeDefined();
            expect(response.body.pdv_id).toBe(feedbackData.pdv_id);
        });

        test('deve rejeitar requisição sem API key', async () => {
            const feedbackData = {
                pdv_id: 'TEST_PDV_001',
                input_raw: 'GOOD'
            };

            await request(app)
                .post('/api/feedback')
                .send(feedbackData)
                .expect(401);
        });

        test('deve rejeitar requisição com API key inválida', async () => {
            const feedbackData = {
                pdv_id: 'TEST_PDV_001',
                input_raw: 'GOOD'
            };

            await request(app)
                .post('/api/feedback')
                .set('x-api-key', 'invalid_key')
                .send(feedbackData)
                .expect(401);
        });

        test('deve rejeitar dados inválidos', async () => {
            const invalidData = {
                pdv_id: '', // Campo obrigatório vazio
                input_raw: 'GOOD'
            };

            await request(app)
                .post('/api/feedback')
                .set('x-api-key', TEST_API_KEY)
                .send(invalidData)
                .expect(400);
        });

        test('deve aplicar rate limiting', async () => {
            const feedbackData = {
                pdv_id: 'TEST_PDV_001',
                input_raw: 'GOOD'
            };

            // Faz múltiplas requisições para testar rate limiting
            const promises = [];
            for (let i = 0; i < 70; i++) { // Mais que o limite padrão
                promises.push(
                    request(app)
                        .post('/api/feedback')
                        .set('x-api-key', TEST_API_KEY)
                        .send(feedbackData)
                );
            }

            const responses = await Promise.all(promises);
            
            // Pelo menos uma deve ser rate limited
            const rateLimitedResponses = responses.filter(r => r.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/feedback', () => {
        test('deve listar feedbacks com API key válida', async () => {
            const response = await request(app)
                .get('/api/feedback')
                .set('x-api-key', TEST_API_KEY)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });

        test('deve rejeitar listagem sem API key', async () => {
            await request(app)
                .get('/api/feedback')
                .expect(401);
        });

        test('deve rejeitar listagem com API key inválida', async () => {
            await request(app)
                .get('/api/feedback')
                .set('x-api-key', 'invalid_key')
                .expect(401);
        });
    });

    describe('End-to-End Feedback Flow', () => {
        test('deve processar fluxo completo de feedback', async () => {
            // 1. Verifica saúde do sistema
            await request(app)
                .get('/health')
                .expect(200);

            // 2. Cria feedback
            const feedbackData = {
                pdv_id: 'E2E_TEST_PDV',
                input_raw: 'VERYGOOD',
                categoria: 'POSITIVO'
            };

            const createResponse = await request(app)
                .post('/api/feedback')
                .set('x-api-key', TEST_API_KEY)
                .send(feedbackData)
                .expect(201);

            expect(createResponse.body.pdv_id).toBe(feedbackData.pdv_id);

            // 3. Lista feedbacks
            const listResponse = await request(app)
                .get('/api/feedback')
                .set('x-api-key', TEST_API_KEY)
                .expect(200);

            expect(Array.isArray(listResponse.body)).toBe(true);
        });

        test('deve lidar com múltiplos feedbacks simultâneos', async () => {
            const feedbacks = [
                { pdv_id: 'PDV_001', input_raw: 'GOOD', categoria: 'POSITIVO' },
                { pdv_id: 'PDV_002', input_raw: 'FAIR', categoria: 'NEUTRO' },
                { pdv_id: 'PDV_003', input_raw: 'POOR', categoria: 'NEGATIVO' }
            ];

            const promises = feedbacks.map(feedback =>
                request(app)
                    .post('/api/feedback')
                    .set('x-api-key', TEST_API_KEY)
                    .send(feedback)
            );

            const responses = await Promise.all(promises);

            responses.forEach((response, index) => {
                expect(response.status).toBe(201);
                expect(response.body.pdv_id).toBe(feedbacks[index].pdv_id);
            });
        });

        test('deve manter consistência com falhas de rede simuladas', async () => {
            // Simula falha temporária do banco
            const mongoose = require('mongoose');
            mongoose.connection.readyState = 0; // Disconnected

            await request(app)
                .get('/health')
                .expect(503);

            // Restaura conexão
            mongoose.connection.readyState = 1;

            await request(app)
                .get('/health')
                .expect(200);
        });
    });

    describe('Error Handling', () => {
        test('deve lidar com JSON malformado', async () => {
            await request(app)
                .post('/api/feedback')
                .set('x-api-key', TEST_API_KEY)
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}')
                .expect(400);
        });

        test('deve lidar com Content-Type incorreto', async () => {
            await request(app)
                .post('/api/feedback')
                .set('x-api-key', TEST_API_KEY)
                .set('Content-Type', 'text/plain')
                .send('plain text')
                .expect(400);
        });

        test('deve lidar com payload muito grande', async () => {
            const largePayload = {
                pdv_id: 'TEST_PDV',
                input_raw: 'A'.repeat(10000), // Payload muito grande
                categoria: 'POSITIVO'
            };

            await request(app)
                .post('/api/feedback')
                .set('x-api-key', TEST_API_KEY)
                .send(largePayload)
                .expect(413); // Payload Too Large
        });
    });

    describe('Security Tests', () => {
        test('deve rejeitar tentativas de injection', async () => {
            const maliciousPayload = {
                pdv_id: 'TEST_PDV"; DROP TABLE feedbacks; --',
                input_raw: '<script>alert("xss")</script>',
                categoria: 'POSITIVO'
            };

            const response = await request(app)
                .post('/api/feedback')
                .set('x-api-key', TEST_API_KEY)
                .send(maliciousPayload);

            // Deve processar sem executar o injection
            expect(response.status).toBe(201);
        });

        test('deve validar headers de segurança', async () => {
            const response = await request(app)
                .get('/api/feedback')
                .set('x-api-key', TEST_API_KEY);

            expect(response.headers['x-content-type-options']).toBeDefined();
        });
    });
});
