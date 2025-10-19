// src/infrastructure/listeners/keyboardListener.js
const CONFIG = require('../../config');

let gkl = null;
let attached = false;
let keyBuffer = [];
const BUFFER_TIMEOUT_MS = 150;
let bufferTimer = null;
const ALLOWED_CHARS_REGEX = /^[a-zA-Z0-9]$/;
const IGNORE_KEYS = new Set([
    'LEFT SHIFT', 'RIGHT SHIFT', 'SHIFT', 'LEFT CTRL', 'RIGHT CTRL', 'CTRL',
    'LEFT ALT', 'RIGHT ALT', 'ALT', 'LEFT META', 'RIGHT META', 'META'
]);

let windowService = null;
try {
    windowService = require('../services/windowService');
} catch (e) { windowService = null; }

// --- RECEBER O logWatcher via parâmetro ---
let logWatcherInstance = null; // Guardará a instância do logWatcher

async function isPdvStillActive() {
    // Implementação não muda...
    if (!CONFIG.enable_keyboard_listener) return false;
    try {
        if (windowService && typeof windowService.isPdvActive === 'function') {
            const active = await Promise.race([
                windowService.isPdvActive().catch(() => false),
                new Promise((res) => setTimeout(() => res(false), 300))
            ]);
            return active;
        }
    } catch (err) { return false; }
    return true;
}

// Modificado para receber logWatcher
function createKeyboardListener(onWordCaptured, watcher) {
    if (!CONFIG.enable_keyboard_listener) {
        console.warn('[keyboardListener] disabled by configuration.');
        return { start: () => {}, stop: () => {} };
    }

     // --- ARMAZENA A INSTÂNCIA DO WATCHER ---
     logWatcherInstance = watcher;
     if (!logWatcherInstance || typeof logWatcherInstance.getIsSaleActive !== 'function') {
         console.error('[keyboardListener] Instância do logWatcher inválida ou não fornecida!');
         // Decide se quer parar ou continuar sem a lógica de venda ativa
         // Por segurança, vamos desativar o listener se o watcher não estiver ok
         return { start: () => {}, stop: () => {} };
     }
     // ----------------------------------------

    try {
        const { GlobalKeyboardListener } = require('node-global-key-listener');
        gkl = new GlobalKeyboardListener();
    } catch (e) {
        console.error('[keyboardListener] failed to require global key listener:', e.message);
        return { start: () => {}, stop: () => {} };
    }

    const clearBufferOnTimeout = () => { /* ... implementação não muda ... */
        if (keyBuffer.length > 0) {
            console.log(`[keyboardListener] Buffer timed out. Clearing buffer.`);
            keyBuffer = [];
        }
    };

    const handler = async (e) => {
        // *** NOVA VERIFICAÇÃO: Venda Ativa? ***
        const isSaleCurrentlyActive = logWatcherInstance.getIsSaleActive();
        if (!isSaleCurrentlyActive) {
            if (keyBuffer.length > 0) keyBuffer = []; // Limpa buffer se tecla chegar fora da venda
            return; // Ignora teclas se a venda não estiver ativa
        }
        // ************************************

        const pdvActive = await isPdvStillActive();
        if (!pdvActive) {
            if (keyBuffer.length > 0) keyBuffer = [];
            return;
        }

        const keyName = e.name || e.key || '';
        if (bufferTimer) clearTimeout(bufferTimer);

        if (keyName.toUpperCase() === 'RETURN' || keyName.toUpperCase() === 'ENTER') {
            if (keyBuffer.length > 0) {
                const word = keyBuffer.join('');
                console.log(`[keyboardListener] ENTER detected during active sale. Processing word: "${word}"`);
                try {
                    if (typeof onWordCaptured === 'function') {
                        onWordCaptured(word); // Envia para processFeedback (que agora só armazena)
                    }
                } catch (cbErr) { console.error('[keyboardListener] Error calling onWordCaptured:', cbErr); }
                keyBuffer = [];
            } else {
                 console.log(`[keyboardListener] ENTER detected with empty buffer. Ignoring.`);
            }
            return;
        }

        if (IGNORE_KEYS.has(keyName.toUpperCase())) {
            bufferTimer = setTimeout(clearBufferOnTimeout, BUFFER_TIMEOUT_MS);
            return;
        }

        if (e.state === 'DOWN' && keyName.length === 1 && ALLOWED_CHARS_REGEX.test(keyName)) {
            keyBuffer.push(keyName.toUpperCase());
        } else if (e.state === 'DOWN') {
             if (keyBuffer.length > 0) {
                console.log(`[keyboardListener] Invalid key "${keyName}" during sale. Clearing buffer.`);
                keyBuffer = [];
             }
        }
        bufferTimer = setTimeout(clearBufferOnTimeout, BUFFER_TIMEOUT_MS);
    };

    function start() { /* ... implementação não muda ... */
         try {
            if (gkl && !attached) {
                gkl.addListener(handler);
                attached = true;
            }
        } catch (err) { console.error('[keyboardListener] Error attaching listener:', err); }
    }
    function stop() { /* ... implementação não muda ... */
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