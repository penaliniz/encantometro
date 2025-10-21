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
let saleEndTimer = null; // <--- Timer para atrasar a finalização da venda

// Callbacks
let onSaleStartCallback = () => {};
let onSaleEndCallback = (feedback, transactionData) => {};

// Configurações de performance
// const DEBOUNCE_DELAY = 1000; // Original
// const DEBOUNCE_DELAY = 200; // Primeira tentativa
const DEBOUNCE_DELAY = 50; // Tentativa atual - valor baixo
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
    // Limpa timer de finalização de venda
    if (saleEndTimer) {
        clearTimeout(saleEndTimer);
        saleEndTimer = null;
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
                encoding: 'latin1', // Mantém latin1 se for o encoding correto do log
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
            lastFileSize = 0; // Resetar para ler do início na próxima mudança

            // Tentativa de reler imediatamente para pegar o estado atual
            try {
                const truncatedData = fs.readFileSync(LOG_FILE_PATH, 'latin1');
                if (truncatedData) {
                    processNewLogContent(truncatedData);
                    lastFileSize = truncatedData.length;
                } else {
                    lastFileSize = 0;
                }
            } catch (readErr) {
                 console.error('[logWatcher] Erro ao reler arquivo truncado:', readErr.message);
                 lastFileSize = 0; // Garante que na próxima mudança ele leia do início
            }

        } else {
            // Tamanho não mudou, log apenas para debug se necessário
            // console.log('[logWatcher] Tamanho do arquivo inalterado.');
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
        const delay = 2000 * retryCount; // Backoff exponencial
        console.log(`[logWatcher] Tentativa de retry ${retryCount}/${MAX_RETRY_ATTEMPTS} em ${delay}ms`);
        // Agenda retry para processFileChanges, não para si mesma recursivamente
        setTimeout(() => {
            // Não chama processFileChanges diretamente aqui para evitar loop infinito em caso de erro persistente.
            // A próxima deteção de mudança pelo fs.watch tentará novamente.
             console.log('[logWatcher] Aguardando próxima mudança para tentar novamente...');
        }, delay);
    } else {
        console.error('[logWatcher] Máximo de tentativas atingido. Parando monitoramento.');
        cleanupResources(); // Para o watcher após falhas repetidas
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

        // Verifica START_SALE_LINE
        if (trimmedLine.includes(START_SALE_LINE)) {
            console.log(`[logWatcher] DETECTADO: Linha de início de venda!`);
            // Se uma finalização estava agendada, cancela, pois uma nova venda começou
            if (saleEndTimer) {
                console.log('[logWatcher] Nova venda iniciada, cancelando finalização agendada anterior.');
                clearTimeout(saleEndTimer);
                saleEndTimer = null;
            }
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
            let currentTransactionData = null; // Variável local para os dados desta linha
            if (separatorIndex !== -1) {
                currentTransactionData = trimmedLine.substring(separatorIndex + END_SALE_SEPARATOR.length).trim();
                console.log(`[logWatcher] Dados da transação extraídos: "${currentTransactionData}"`);
            } else {
                console.log(`[logWatcher] Linha de fim de venda sem dados após '${END_SALE_SEPARATOR}'`);
            }

            // --- LÓGICA DE DELAY ---
            // Verifica se a venda está ativa. Se sim, agenda a finalização em vez de fazer imediatamente.
            // E só agenda se não houver já uma finalização pendente
            if (isSaleActive && !saleEndTimer) {
                // Guarda os dados da transação que acabaram de ser lidos
                lastTransactionData = currentTransactionData;

                console.log(`[logWatcher] Linha de fim encontrada. Agendando finalização em 250ms para permitir captura de feedback.`);

                // Agenda a finalização real da venda
                saleEndTimer = setTimeout(() => {
                    // Verifica novamente se a venda ainda deveria estar ativa
                    if (isSaleActive) {
                         isSaleActive = false;
                         console.log(`[logWatcher] Estado: Venda FINALIZADA (após delay).`);
                         // Chama o callback final com o feedback que pode ter sido capturado durante o delay
                         onSaleEndCallback(lastFeedbackReceived, lastTransactionData);
                         lastFeedbackReceived = null; // Limpa para a próxima
                         lastTransactionData = null;
                         saleEndTimer = null; // Limpa o timer
                    } else {
                         console.log('[logWatcher] Finalização agendada ignorada, venda já não estava ativa.');
                         saleEndTimer = null; // Limpa o timer mesmo assim
                    }
                }, 250); // Atraso de 250ms - ajuste se necessário

            } else if (saleEndTimer) {
                 console.log(`[logWatcher] Linha de fim encontrada, mas finalização já está agendada. Ignorando esta linha.`);
                 // Opcionalmente, pode atualizar lastTransactionData se quiser os dados da *última* linha de fim encontrada
                 // lastTransactionData = currentTransactionData;
            } else {
                console.log(`[logWatcher] Aviso: Linha de fim encontrada mas venda não estava ativa.`);
            }
            // ---------------------------

        } // Fim do 'else if (trimmedLine.includes(END_SALE_LINE))'
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
        // Retorna um objeto "dummy" para evitar crash no index.js
        return { watcher: { stop: () => {} }, setLastFeedback: ()=>{}, getIsSaleActive: ()=>false, cleanupResources: ()=>{} };
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
        lastFileSize = 0; // Assume 0 se não conseguir ler
    }

    // Usa fs.watch (eventos nativos) em vez de fs.watchFile (polling)
    try {
        watcher = fs.watch(LOG_FILE_PATH, { persistent: true }, (eventType, filename) => {
            // Eventos 'rename' podem indicar que o ficheiro foi substituído (log rotation)
            if (eventType === 'change' || eventType === 'rename') {
                console.log(`[logWatcher] Evento '${eventType}' detectado no arquivo: ${filename || LOG_FILE_PATH}`);
                // Usa debouncing para evitar processamento excessivo
                debouncedFileProcess();
            }
        });

        // Trata erros do watcher
        watcher.on('error', (err) => {
            console.error('[logWatcher] Erro no watcher (fs.watch):', err.message);
            // Tenta reiniciar o watcher em caso de erro? Ou apenas loga?
            // Por segurança, vamos parar se o watcher falhar
            cleanupResources();
            // Poderia tentar reiniciar aqui com um backoff
        });

        isWatching = true;
        console.log('[logWatcher] Monitoramento fs.watch configurado com debouncing.');

    } catch (watchErr) {
         console.error('[logWatcher] Erro CRÍTICO ao iniciar fs.watch:', watchErr);
         cleanupResources();
         // Retorna um objeto "dummy"
         return { watcher: { stop: () => {} }, setLastFeedback: ()=>{}, getIsSaleActive: ()=>false, cleanupResources: ()=>{} };
    }

    // Função setLastFeedback com log de debug adicionado
    function setLastFeedback(feedbackWord) {
        // --- Adicionado Log de Debug ---
        console.log(`[logWatcher DEBUG] setLastFeedback chamado com: "${feedbackWord}". Venda ativa? ${isSaleActive}`);
        // -----------------------------
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
    // Usamos uma flag simples para evitar registar múltiplos listeners se startWatching for chamado mais de uma vez
    if (!process.env._logWatcherCleanupRegistered) {
        process.on('SIGINT', () => {
            console.log('[logWatcher] SIGINT recebido. Limpando recursos...');
            cleanupResources();
            // Damos um pequeno tempo para cleanup antes de realmente sair
            setTimeout(() => process.exit(0), 100);
        });

        process.on('SIGTERM', () => {
            console.log('[logWatcher] SIGTERM recebido. Limpando recursos...');
            cleanupResources();
            setTimeout(() => process.exit(0), 100);
        });

        process.on('exit', (code) => {
            // Este pode ser chamado depois dos outros, garante uma última limpeza
            console.log(`[logWatcher] Processo saindo com código ${code}. Limpando recursos...`);
            cleanupResources();
        });
        process.env._logWatcherCleanupRegistered = 'true';
    }

    return {
        watcher: { stop: stopWatching },
        setLastFeedback,
        getIsSaleActive,
        cleanupResources // Expõe função de cleanup para uso externo
    };
}

module.exports = { startWatching };