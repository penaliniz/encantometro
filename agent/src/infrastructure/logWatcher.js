// src/infrastructure/logWatcher.js
const fs = require('fs');
const path = require('path');

// Configurações do log
const LOG_FILE_PATH = 'c:\\p2k\\bin\\CSIDebugFile.txt';
const START_SALE_LINE = "MicSolicitaCpfFidelidade::processa::Contador evento transacao";
const END_SALE_LINE = "GerenciadorCMOS :: atualizaRecebimentos :: consultando a transação";
const END_SALE_SEPARATOR = "->";

// Estado interno
let isSaleActive = false;
let lastFeedbackReceived = null;
let lastTransactionData = null;
let lastFileSize = 0; // Guarda o tamanho do ficheiro da última leitura
let watcher = null; // Guarda a referência do watcher (fs.watch)
let debounceTimer = null; // Timer para debouncing
let isWatching = false; // Flag para controlar estado do watcher

// Callbacks
let onSaleStartCallback = () => {};
let onSaleEndCallback = (feedback, transactionData) => {};

// Configurações de performance
const DEBOUNCE_DELAY = 1000; // 1 segundo de debounce
const MAX_RETRY_ATTEMPTS = 3;
let retryCount = 0;

/**
 * Limpa recursos e timers para prevenir memory leaks
 */
function cleanupResources() {
    // Limpa timer de debounce
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    
    // Para o watcher se estiver ativo
    if (watcher && isWatching) {
        try {
            watcher.close();
            console.log('[logWatcher] Watcher fechado e recursos limpos.');
        } catch (err) {
            console.error('[logWatcher] Erro ao fechar watcher:', err.message);
        }
        watcher = null;
        isWatching = false;
    }
    
    // Reset do contador de retry
    retryCount = 0;
}

/**
 * Implementa debouncing para evitar processamento excessivo
 */
function debouncedFileProcess() {
    // Limpa timer anterior se existir
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    
    // Cria novo timer
    debounceTimer = setTimeout(() => {
        processFileChanges();
        debounceTimer = null;
    }, DEBOUNCE_DELAY);
}

/**
 * Processa mudanças no arquivo de forma otimizada
 */
function processFileChanges() {
    if (!fs.existsSync(LOG_FILE_PATH)) {
        console.warn('[logWatcher] Arquivo não existe durante processamento.');
        return;
    }
    
    try {
        const stats = fs.statSync(LOG_FILE_PATH);
        
        // Verifica se o arquivo cresceu
        if (stats.size > lastFileSize) {
            console.log(`[logWatcher] Processando mudanças: ${lastFileSize} -> ${stats.size} bytes`);
            
            // Lê apenas o novo conteúdo
            const stream = fs.createReadStream(LOG_FILE_PATH, {
                encoding: 'latin1',
                start: lastFileSize,
                end: stats.size - 1
            });
            
            let newData = '';
            stream.on('data', (chunk) => {
                newData += chunk;
            });
            
            stream.on('end', () => {
                if (newData) {
                    processNewLogContent(newData);
                }
                lastFileSize = stats.size;
                retryCount = 0; // Reset retry count on success
            });
            
            stream.on('error', (err) => {
                console.error('[logWatcher] Erro ao ler stream:', err.message);
                handleFileError(err);
            });
            
        } else if (stats.size < lastFileSize) {
            // Arquivo foi truncado ou substituído
            console.warn('[logWatcher] Arquivo foi truncado. Reprocessando completamente.');
            lastFileSize = 0;
            
            fs.readFile(LOG_FILE_PATH, 'latin1', (err, data) => {
                if (!err && data) {
                    processNewLogContent(data);
                    lastFileSize = data.length;
                } else {
                    handleFileError(err);
                }
            });
        }
        
    } catch (err) {
        handleFileError(err);
    }
}

/**
 * Trata erros de arquivo com retry logic
 */
function handleFileError(err) {
    console.error('[logWatcher] Erro no processamento do arquivo:', err.message);
    retryCount++;
    
    if (retryCount < MAX_RETRY_ATTEMPTS) {
        console.log(`[logWatcher] Tentativa de retry ${retryCount}/${MAX_RETRY_ATTEMPTS}`);
        setTimeout(() => {
            processFileChanges();
        }, 2000 * retryCount); // Backoff exponencial
    } else {
        console.error('[logWatcher] Máximo de tentativas atingido. Parando monitoramento.');
        cleanupResources();
    }
}

/**
 * Processa APENAS um bloco de novas linhas adicionadas
 */
function processNewLogContent(newContent) {
    const lines = newContent.split('\n');

    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return; // Ignora linhas vazias

        // Log de depuração (reduzido)
        // console.log(`[logWatcher DEBUG] Verificando nova linha: "${trimmedLine}"`);

        // Verifica START_SALE_LINE
        if (trimmedLine.includes(START_SALE_LINE)) {
            console.log(`[logWatcher] DETECTADO: Linha de início de venda!`);
            if (!isSaleActive) {
                isSaleActive = true;
                lastFeedbackReceived = null;
                lastTransactionData = null;
                console.log(`[logWatcher] Estado: Venda INICIADA.`);
                onSaleStartCallback();
            } else {
                 console.log(`[logWatcher] Aviso: Linha de início encontrada mas venda já estava ativa.`);
            }
        }
        // Verifica END_SALE_LINE
        else if (trimmedLine.includes(END_SALE_LINE)) {
            console.log(`[logWatcher] DETECTADO: Linha de fim de venda!`);
            console.log(`[logWatcher DEBUG] Linha completa do fim: "${trimmedLine}"`);

            // Extrai dados
            const separatorIndex = trimmedLine.indexOf(END_SALE_SEPARATOR);
            if (separatorIndex !== -1) {
                lastTransactionData = trimmedLine.substring(separatorIndex + END_SALE_SEPARATOR.length).trim();
                console.log(`[logWatcher] Dados da transação extraídos: "${lastTransactionData}"`);
            } else {
                lastTransactionData = null;
                console.log(`[logWatcher] Linha de fim de venda sem dados após '${END_SALE_SEPARATOR}'`);
            }

            if (isSaleActive) { // Só finaliza se estava ativa
                isSaleActive = false;
                console.log(`[logWatcher] Estado: Venda FINALIZADA.`);
                onSaleEndCallback(lastFeedbackReceived, lastTransactionData); // Chama o callback final
                lastFeedbackReceived = null; // Limpa para a próxima
                lastTransactionData = null;
            } else {
                 console.log(`[logWatcher] Aviso: Linha de fim encontrada mas venda não estava ativa.`);
            }
        }
    });
}

/**
 * Função principal para iniciar o monitoramento (usando fs.watch otimizado)
 */
function startWatching(callbacks) {
    onSaleStartCallback = callbacks.onSaleStart || onSaleStartCallback;
    onSaleEndCallback = callbacks.onSaleEnd || onSaleEndCallback;

    console.log(`[logWatcher] Iniciando monitoramento otimizado (via fs.watch) do arquivo: ${LOG_FILE_PATH}`);

    // Limpa recursos anteriores se existirem
    cleanupResources();

    // Garante que o diretório existe
    try {
        const dir = path.dirname(LOG_FILE_PATH);
        if (!fs.existsSync(dir)) {
            console.warn(`[logWatcher] Diretório ${dir} não encontrado. Tentando criar...`);
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch (err) {
        console.error(`[logWatcher] Erro crítico ao criar diretório:`, err);
        return { watcher: null, setLastFeedback: ()=>{}, getIsSaleActive: ()=>false };
    }

    // Obtém o tamanho inicial do ficheiro (se existir)
    try {
        if (fs.existsSync(LOG_FILE_PATH)) {
            const stats = fs.statSync(LOG_FILE_PATH);
            lastFileSize = stats.size;
            console.log(`[logWatcher] Tamanho inicial do ficheiro: ${lastFileSize} bytes.`);
        } else {
             console.warn(`[logWatcher] Arquivo ${LOG_FILE_PATH} não encontrado inicialmente. Aguardando...`);
             lastFileSize = 0;
        }
    } catch (err) {
        console.error('[logWatcher] Erro ao obter tamanho inicial do ficheiro:', err);
        lastFileSize = 0;
    }

    // Usa fs.watch (eventos nativos) em vez de fs.watchFile (polling)
    try {
        watcher = fs.watch(LOG_FILE_PATH, { persistent: true }, (eventType, filename) => {
            if (eventType === 'change') {
                console.log(`[logWatcher] Mudança detectada no arquivo: ${filename}`);
                // Usa debouncing para evitar processamento excessivo
                debouncedFileProcess();
            }
        });

        // Trata erros do watcher
        watcher.on('error', (err) => {
            console.error('[logWatcher] Erro no watcher:', err.message);
            handleFileError(err);
        });

        isWatching = true;
        console.log('[logWatcher] Monitoramento fs.watch configurado com debouncing.');
        
    } catch (watchErr) {
         console.error('[logWatcher] Erro CRÍTICO ao iniciar fs.watch:', watchErr);
         cleanupResources();
         return { watcher: null, setLastFeedback: ()=>{}, getIsSaleActive: ()=>false };
    }

    // Função setLastFeedback (sem alterações)
    function setLastFeedback(feedbackWord) {
        if (isSaleActive) {
            console.log(`[logWatcher] Feedback recebido durante venda ativa: ${feedbackWord}`);
            lastFeedbackReceived = feedbackWord;
        } else {
            console.log(`[logWatcher] Feedback recebido FORA de uma venda ativa: ${feedbackWord}. Ignorando.`);
        }
    }

    // Função getIsSaleActive (sem alterações)
    function getIsSaleActive() {
        return isSaleActive;
    }


    // Função para parar o watcher com cleanup completo
    function stopWatching() {
        console.log('[logWatcher] Parando monitoramento e limpando recursos...');
        cleanupResources();
    }

    // Registra event listeners para cleanup automático no shutdown (apenas uma vez)
    if (!process.listeners('SIGINT').some(listener => listener.toString().includes('logWatcher'))) {
        process.on('SIGINT', () => {
            console.log('[logWatcher] SIGINT recebido. Limpando recursos...');
            cleanupResources();
        });

        process.on('SIGTERM', () => {
            console.log('[logWatcher] SIGTERM recebido. Limpando recursos...');
            cleanupResources();
        });

        process.on('exit', () => {
            console.log('[logWatcher] Processo saindo. Limpando recursos...');
            cleanupResources();
        });
    }

    return {
        watcher: { stop: stopWatching },
        setLastFeedback,
        getIsSaleActive,
        cleanupResources // Expõe função de cleanup para uso externo
    };
}

module.exports = { startWatching };