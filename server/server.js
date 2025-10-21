// Carrega variáveis de ambiente primeiro
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectToDatabase } = require('./src/infrastructure/database/mongodb');
const feedbackRoutes = require('./src/interfaces/routes/feedbackRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Função principal de inicialização
async function startServer() {
    // 1. Conectar ao Banco de Dados
    await connectToDatabase();

    // 2. Middlewares Globais
    app.use(cors());
    app.use(express.json());

    // 3. Rotas da Aplicação
    app.use('/api/feedback', feedbackRoutes);

    // Middleware de health check (opcional, mas bom)
    app.get('/health', (req, res) => {
        // Verifica se o banco está conectado
        if (require('mongoose').connection.readyState === 1) {
            res.status(200).json({ status: 'UP', db: 'connected' });
        } else {
            res.status(503).json({ status: 'DOWN', db: 'disconnected' });
        }
    });

    // 4. Iniciar o Servidor
    app.listen(PORT, () => {
        console.log('--- Servidor de Feedback Iniciado ---');
        console.log(`API rodando na porta ${PORT}`);
        console.log(`Endpoint de recebimento: http://localhost:${PORT}/api/feedback (POST)`);
        console.log(`Endpoint de visualização: http://localhost:${PORT}/api/feedback (GET)`);
        console.log(`Health check: http://localhost:${PORT}/health (GET)`);
    });
}

// Inicia a aplicação
startServer().catch(err => {
    console.error("Falha ao iniciar o servidor:", err);
    process.exit(1);
});