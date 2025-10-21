// Responsável por gerenciar a conexão com o MongoDB.
const mongoose = require('mongoose');

/**
 * Valida se a URI do MongoDB está em formato correto e seguro
 * @param {string} uri - URI do MongoDB para validar
 * @returns {boolean} - true se válida, false caso contrário
 */
function validateMongoUri(uri) {
    if (!uri || typeof uri !== 'string') {
        return false;
    }

    // Remove espaços em branco
    const cleanUri = uri.trim();

    // Verifica se começa com mongodb:// ou mongodb+srv://
    const validProtocols = /^mongodb(\+srv)?:\/\//;
    if (!validProtocols.test(cleanUri)) {
        console.error('[mongodb] URI deve começar com mongodb:// ou mongodb+srv://');
        return false;
    }

    // Verifica se contém caracteres suspeitos (removido o & da lista)
    const suspiciousChars = /[<>'"`;|${}()[\]\\]/;
    if (suspiciousChars.test(cleanUri)) {
        console.error('[mongodb] URI contém caracteres suspeitos que podem indicar injection');
        return false;
    }

    // Verifica se tem pelo menos um host válido, ignorando credenciais
    // Regex ajustada para capturar o host *depois* de "user:pass@" opcional
    const hostPattern = /mongodb(?:\+srv)?:\/\/(?:[^@\/]+@)?([^\/?]+)/;
    const hostMatch = cleanUri.match(hostPattern);

    // Agora o host principal (ou lista de hosts) está em hostMatch[1]
    if (!hostMatch || !hostMatch[1]) {
        console.error('[mongodb] URI não contém um host válido após as credenciais');
        return false;
    }

    // Validação adicional para hosts suspeitos
    const hostsString = hostMatch[1]; // A parte que contém apenas os hosts
    const hosts = hostsString.split(','); // Separa se houver múltiplos hosts (comum em mongodb://)
    for (const host of hosts) {
        const cleanHost = host.trim();
        // Verifica se é um IP válido ou domínio válido (sem porta ou com porta)
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
        // Regex de domínio um pouco mais permissiva para subdomínios de clusters, etc.
        const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9.\-]{0,61}[a-zA-Z0-9])?(:\d+)?$/;

        // Verifica se o IP está dentro dos limites válidos (0-255)
        let isValidIp = ipPattern.test(cleanHost);
        if (isValidIp) {
            const parts = cleanHost.split(':')[0].split('.');
            if (parts.some(part => parseInt(part, 10) > 255)) {
                isValidIp = false;
            }
        }

        if (!isValidIp && !domainPattern.test(cleanHost)) {
            console.error(`[mongodb] Host inválido na URI: ${cleanHost}`);
            return false;
        }
    }

    return true;
}

async function connectToDatabase() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('ERRO FATAL: MONGODB_URI não definida no .env');
        process.exit(1);
    }

    // Valida a URI antes de tentar conectar
    if (!validateMongoUri(uri)) {
        console.error('ERRO FATAL: MONGODB_URI inválida ou suspeita');
        process.exit(1);
    }

    try {
        // Configurações de segurança adicionais
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // Timeout de conexão para evitar travamentos
            serverSelectionTimeoutMS: 10000,
            // Timeout de socket para evitar conexões órfãs
            socketTimeoutMS: 45000,
            // Máximo de tentativas de reconexão
            maxPoolSize: 10
        };

        await mongoose.connect(uri, options);
        console.log('[mongodb] Conexão com o MongoDB estabelecida com sucesso.');

        // Configuração de eventos de conexão para monitoramento
        mongoose.connection.on('error', (err) => {
            console.error('[mongodb] Erro de conexão:', err.message);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('[mongodb] Conexão com MongoDB perdida');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('[mongodb] Reconectado ao MongoDB');
        });

    } catch (error) {
        console.error('[mongodb] Erro ao conectar com o MongoDB:', error.message);
        process.exit(1);
    }
}

module.exports = { connectToDatabase, validateMongoUri };