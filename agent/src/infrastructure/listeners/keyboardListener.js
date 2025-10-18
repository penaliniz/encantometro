// src/infrastructure/listeners/keyboardListener.js
// INFRASTRUCTURE: Adaptador de Entrada (Input Adapter)
// Implementação concreta para ouvir o teclado global.

/**
 * Listener de teclado com mitigação de captura global sensível.
 * - DESABILITADO por padrão (ativa com CONFIG.enable_keyboard_listener = true)
 * - Só captura teclas da whitelist (controles/atalhos), evita capturar texto digitado
 * - Opcional: verifica se janela PDV está ativa chamando windowService.isPdvActive()
 * - Debounce por tecla para reduzir vazamento/high-frequency
 */

const CONFIG = require('../../config');

let gkl = null;
let attached = false;
let lastSeen = Object.create(null);
const DEBOUNCE_MS = Number(CONFIG.keyboard_debounce_ms) || 300;
const ENABLE = Boolean(CONFIG.enable_keyboard_listener);

/* whitelist de teclas de controle/atalhos — evita capturar caracteres alfanuméricos */
const WHITELIST_KEYS = new Set([
    'enter','escape','tab','backspace','delete',
    'up','down','left','right',
    'f1','f2','f3','f4','f5','f6','f7','f8','f9','f10','f11','f12',
    'home','end','pageup','pagedown',
    'printscreen','insert'
]);

/* tentativa de integração com windowService (se expuser isPdvActive) */
let windowService = null;
try {
    windowService = require('../services/windowService');
} catch (e) {
    windowService = null;
}

/**
 * decide se devemos processar o evento de tecla
 * - evita caracteres imprimíveis (letras, números, símbolos)
 * - usa whitelist de teclas de controle
 * - verifica debounce
 * - opcionalmente verifica foco da janela PDV
 */
async function shouldProcessKey(keyName) {
    if (!ENABLE) return false;

    if (!keyName) return false;
    const name = String(keyName).toLowerCase();

    // só teclas explicitamente permitidas
    if (!WHITELIST_KEYS.has(name)) return false;

    // debounce simples por tecla
    const now = Date.now();
    const last = lastSeen[name] || 0;
    if (now - last < DEBOUNCE_MS) return false;
    lastSeen[name] = now;

    // se windowService oferece isPdvActive, somente processar se PDV ativo
    try {
        if (windowService && typeof windowService.isPdvActive === 'function') {
            const active = await Promise.race([
                windowService.isPdvActive().catch(() => false),
                new Promise((res) => setTimeout(() => res(false), 300)) // timeout curto
            ]);
            if (!active) return false;
        }
    } catch (err) {
        // falha segura -> não processar para reduzir surface de risco
        return false;
    }

    return true;
}

/**
 * cria o listener (não assume attach imediato) — retorna { start, stop }
 */
function createKeyboardListener(onShortcut) {
    // onShortcut: (meta) => {}
    if (!ENABLE) {
        console.warn('[keyboardListener] disabled by configuration (enable_keyboard_listener=false).');
        return {
            start: () => {},
            stop: () => {}
        };
    }

    try {
        const { GlobalKeyboardListener } = require('node-global-key-listener');
        gkl = new GlobalKeyboardListener();
    } catch (e) {
        console.error('[keyboardListener] failed to require global key listener:', e.message);
        return {
            start: () => {},
            stop: () => {}
        };
    }

    const handler = async (e) => {
        try {
            const keyName = e.name || e.key || (e.keychar && String(e.keychar)) || '';
            if (!keyName) return;

            const processIt = await shouldProcessKey(keyName);
            if (!processIt) return;

            const meta = {
                key: String(keyName).toLowerCase(),
                timestamp: Date.now()
            };

            try {
                if (typeof onShortcut === 'function') onShortcut(meta);
            } catch (cbErr) { /* swallow */ }
        } catch (err) {
            console.error('[keyboardListener] handler error (no payload):', err.message);
        }
    };

    function start() {
        try {
            if (gkl && !attached) {
                gkl.addListener(handler);
                attached = true;
            }
        } catch (err) { /* ignore */ }
    }

    function stop() {
        try {
            if (gkl && attached) {
                gkl.removeListener(handler);
            }
        } catch (err) { /* ignore */ }
        attached = false;
    }

    // opcional: começar imediatamente (mantive comportamento seguro: não auto-start)
    // start();

    return { start, stop };
}

module.exports = { createKeyboardListener };