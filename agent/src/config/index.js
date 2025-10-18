// src/config/index.js
const fs = require('fs');
const path = require('path');

// Garante que o caminho para config.json está correto, partindo da raiz do projeto
const configPath = path.resolve(__dirname, '..', '..', 'config.json');

let CONFIG;
try {
    const configFile = fs.readFileSync(configPath, 'utf-8');
    CONFIG = JSON.parse(configFile);
} catch (error) {
    console.error(`[${new Date().toISOString()}] ERRO FATAL: Não foi possível carregar o config.json em ${configPath}`);
    console.error(error.message);
    process.exit(1); // Falha se a configuração não puder ser lida
}

module.exports = CONFIG;