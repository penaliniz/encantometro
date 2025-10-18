// src/infrastructure/services/windowService.js
// INFRASTRUCTURE: Adaptador de Saída (Output Adapter)
// Implementação concreta para interagir com o Sistema Operacional.

const { exec, spawn } = require('child_process');
const path = require('path');
const activeWin = require('active-win');
const CONFIG = require('../../config');

/**
 * Executa o script PowerShell para devolver o foco à janela do PDV.
 */
function refocusPdv() {
    // validação simples do título para evitar entrada maliciosa
    const rawTitle = String(CONFIG.pdv_window_title || '').trim();
    if (!rawTitle || rawTitle.length === 0 || rawTitle.length > 200) {
        console.error(`[${new Date().toISOString()}] refocusPdv: título inválido.`);
        return Promise.reject(new Error('Título do PDV inválido.'));
    }
    // whitelist de caracteres básicos
    if (!/^[\w\d\s\-\._,;:()\/\\]+$/.test(rawTitle)) {
        console.error(`[${new Date().toISOString()}] refocusPdv: título contém caracteres não permitidos.`);
        return Promise.reject(new Error('Título do PDV contém caracteres inválidos.'));
    }

    const scriptPath = path.resolve(__dirname, '..', '..', '..', 'scripts', 'refocusPdv.ps1');

    return new Promise((resolve, reject) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-File', scriptPath, '--title', rawTitle], { windowsHide: true });

        const timeoutMs = 5000;
        const timer = setTimeout(() => {
            child.kill();
            const err = new Error('Timeout ao tentar focar janela do PDV');
            console.error(`[${new Date().toISOString()}] ${err.message}`);
            reject(err);
        }, timeoutMs);

        child.on('error', (err) => {
            clearTimeout(timer);
            console.error(`[${new Date().toISOString()}] Erro ao tentar focar no PDV:`, err.message);
            reject(err);
        });

        child.on('exit', (code) => {
            clearTimeout(timer);
            if (code === 0) {
                console.log(`[${new Date().toISOString()}] Foco retornado com sucesso para a janela '${rawTitle}'`);
                resolve();
            } else {
                const err = new Error(`Script PowerShell encerrou com código ${code}`);
                console.error(`[${new Date().toISOString()}] ${err.message}`);
                reject(err);
            }
        });
    });
}

/**
 * Retorna Promise<boolean> indicando se a janela ativa contém o título do PDV configurado.
 */
async function isPdvActive() {
    try {
        const rawTitle = String(CONFIG.pdv_window_title || '').trim();
        // validação do título
        if (!rawTitle || rawTitle.length === 0 || rawTitle.length > 200) {
            return false;
        }
        if (!/^[\w\d\s\-\._,;:()\/\\]+$/.test(rawTitle)) {
             return false;
        }

        // Usa active-win
        const info = await activeWin();
        if (!info || !info.title) return false;

        const lcActive = String(info.title).toLowerCase();
        const lcTarget = rawTitle.toLowerCase();

        // Linhas de DEBUG removidas daqui

        return lcActive.includes(lcTarget);
    } catch (e) {
        // fallback seguro
        return false;
    }
}

module.exports = { refocusPdv, isPdvActive };