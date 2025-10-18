// src/infrastructure/listeners/keyboardListener.js
// INFRASTRUCTURE: Adaptador de Entrada (Input Adapter)
// Implementação concreta para ouvir o teclado (bufferizado).

const CONFIG = require('../../config');

let gkl = null;
let attached = false;
let keyBuffer = []; // Armazena as teclas digitadas
const BUFFER_TIMEOUT_MS = 150; // Tempo para limpar o buffer
let bufferTimer = null;
const ALLOWED_CHARS_REGEX = /^[a-zA-Z0-9]$/; // Permite alfanuméricos no buffer

// Teclas modificadoras a serem ignoradas
const IGNORE_KEYS = new Set([
    'LEFT SHIFT', 'RIGHT SHIFT', 'SHIFT',
    'LEFT CTRL', 'RIGHT CTRL', 'CTRL',
    'LEFT ALT', 'RIGHT ALT', 'ALT',
    'LEFT META', 'RIGHT META', 'META'
]);

let windowService = null;
try {
    windowService = require('../services/windowService');
} catch (e) {
    windowService = null;
}

async function isPdvStillActive() {
    // A implementação desta função permanece a mesma da versão anterior
    if (!CONFIG.enable_keyboard_listener) return false;
    try {
        if (windowService && typeof windowService.isPdvActive === 'function') {
            // Usamos um timeout curto para evitar bloqueios longos
            const active = await Promise.race([
                windowService.isPdvActive().catch(() => false),
                new Promise((res) => setTimeout(() => res(false), 300))
            ]);
            return active;
        }
    } catch (err) {
        return false;
    }
    // Se o serviço não estiver disponível, assume que está ativo por segurança (pode ajustar se necessário)
    return true;
}

function createKeyboardListener(onWordCaptured) {
    if (!CONFIG.enable_keyboard_listener) {
        console.warn('[keyboardListener] disabled by configuration.');
        return { start: () => {}, stop: () => {} };
    }

    try {
        const { GlobalKeyboardListener } = require('node-global-key-listener');
        gkl = new GlobalKeyboardListener();
    } catch (e) {
        console.error('[keyboardListener] failed to require global key listener:', e.message);
        return { start: () => {}, stop: () => {} };
    }

    // Função para limpar o buffer no timeout
    const clearBufferOnTimeout = () => {
        if (keyBuffer.length > 0) {
            console.log(`[keyboardListener] Buffer timed out. Clearing buffer.`); // Log útil mantido
            keyBuffer = [];
        }
    };

    const handler = async (e) => {
        // Verifica a janela ativa PRIMEIRO
        const pdvActive = await isPdvStillActive();
        if (!pdvActive) {
            if (keyBuffer.length > 0) keyBuffer = []; // Limpa se foco perdido ANTES de processar
            return; // Ignora completamente se janela não ativa
        }

        const keyName = e.name || e.key || '';

        // *** REMOVIDA a verificação de e.state === 'UP' ***

        // Limpa o timer de timeout anterior
        if (bufferTimer) clearTimeout(bufferTimer);

        // Verifica ENTER primeiro (tanto DOWN quanto UP podem acionar)
        if (keyName.toUpperCase() === 'RETURN' || keyName.toUpperCase() === 'ENTER') {
             // Só processa se o buffer não estiver vazio (evita ENTERs duplos)
            if (keyBuffer.length > 0) {
                const word = keyBuffer.join('');
                 console.log(`[keyboardListener] ENTER detected. Processing word: "${word}"`); // Log útil mantido
                try {
                    if (typeof onWordCaptured === 'function') {
                        onWordCaptured(word);
                    }
                } catch (cbErr) { console.error('[keyboardListener] Error calling onWordCaptured:', cbErr); }
                keyBuffer = []; // Limpa o buffer APÓS processar
            } else {
                 console.log(`[keyboardListener] ENTER detected with empty buffer. Ignoring.`); // Log útil mantido
            }
             // NÃO reinicia o timer aqui, pois a sequência terminou
            return;
        }

        // Ignora teclas modificadoras (sem limpar buffer)
        if (IGNORE_KEYS.has(keyName.toUpperCase())) {
            // Apenas reinicia o timer e ignora
            bufferTimer = setTimeout(clearBufferOnTimeout, BUFFER_TIMEOUT_MS);
            return;
        }

        // Adiciona alfanuméricos ao buffer (APENAS no evento DOWN para evitar duplicação)
        if (e.state === 'DOWN' && keyName.length === 1 && ALLOWED_CHARS_REGEX.test(keyName)) {
            keyBuffer.push(keyName.toUpperCase());
        } else if (e.state === 'DOWN') {
             // Limpa buffer para qualquer outra tecla inesperada no DOWN
             if (keyBuffer.length > 0) { // Só limpa se havia algo
                 console.log(`[keyboardListener] Invalid key "${keyName}" detected. Clearing buffer.`); // Log útil mantido
                keyBuffer = [];
             }
        }
        // Eventos 'UP' de alfanuméricos ou outras teclas são ignorados aqui

        // Reinicia o timer de timeout após qualquer tecla processada (exceto ENTER)
        bufferTimer = setTimeout(clearBufferOnTimeout, BUFFER_TIMEOUT_MS);
    };

    function start() {
        try {
            if (gkl && !attached) {
                gkl.addListener(handler);
                attached = true;
            }
        } catch (err) { console.error('[keyboardListener] Error attaching listener:', err); }
    }

    function stop() {
        try {
            if (gkl && attached) {
                gkl.removeListener(handler);
            }
        } catch (err) { console.error('[keyboardListener] Error detaching listener:', err); }
        attached = false;
        keyBuffer = [];
        if(bufferTimer) clearTimeout(bufferTimer);
    }

    return { start, stop };
}

module.exports = { createKeyboardListener };