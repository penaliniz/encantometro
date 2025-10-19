// src/infrastructure/logWatcher.js
const fs = require('fs');
const path = require('path');
// NÃO precisamos mais do chokidar para esta abordagem
// const chokidar = require('chokidar');

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
let watchListener = null; // Guarda a referência do listener

// Callbacks
let onSaleStartCallback = () => {};
let onSaleEndCallback = (feedback, transactionData) => {};

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
 * Função principal para iniciar o monitoramento (usando fs.watchFile)
 */
function startWatching(callbacks) {
    onSaleStartCallback = callbacks.onSaleStart || onSaleStartCallback;
    onSaleEndCallback = callbacks.onSaleEnd || onSaleEndCallback;

    console.log(`[logWatcher] Iniciando monitoramento (via fs.watchFile) do arquivo: ${LOG_FILE_PATH}`);

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


    // Usa fs.watchFile para monitorar mudanças no ficheiro
    const pollInterval = 500; // Verifica a cada 500ms
    try {
        // fs.watchFile é mais intensivo (polling), mas mais fiável em sistemas Windows
        watchListener = fs.watchFile(LOG_FILE_PATH, { persistent: true, interval: pollInterval }, (curr, prev) => {
            
            // Verifica se o ficheiro foi modificado e cresceu
            if (curr.mtimeMs > prev.mtimeMs && curr.size > lastFileSize) {
                console.log(`[logWatcher] Ficheiro modificado. Lendo de ${lastFileSize} até ${curr.size}`);
                
                // --- CORREÇÃO DE ENCODING APLICADA AQUI ---
                const stream = fs.createReadStream(LOG_FILE_PATH, {
                    encoding: 'latin1', // <-- A CORREÇÃO CRUCIAL
                    start: lastFileSize, // Começa a ler de onde parou
                    end: curr.size
                });
                // ----------------------------------------

                let newData = '';
                stream.on('data', (chunk) => {
                    newData += chunk;
                });
                stream.on('end', () => {
                    if (newData) {
                        processNewLogContent(newData); // Processa apenas o novo conteúdo
                    }
                    lastFileSize = curr.size; // Atualiza o tamanho para a próxima leitura
                });
                stream.on('error', (err) => {
                    console.error('[logWatcher] Erro ao ler stream do ficheiro:', err);
                     lastFileSize = curr.size; // Tenta recuperar
                });

            } else if (curr.size < lastFileSize) {
                // Ficheiro foi truncado ou substituído
                console.warn('[logWatcher] Tamanho do ficheiro diminuiu. Resetando leitura.');
                lastFileSize = 0;
                // (Opcional) Poderia ler o ficheiro inteiro aqui para não perder nada
                fs.readFile(LOG_FILE_PATH, 'latin1', (err, data) => {
                    if (!err && data) {
                        console.log('[logWatcher] Reprocessando ficheiro após truncamento.');
                        processNewLogContent(data);
                        lastFileSize = data.length; // Atualiza para o novo tamanho
                    }
                });

            } else if (curr.ino === 0 && prev.ino !== 0) {
                 console.warn(`[logWatcher] Arquivo ${LOG_FILE_PATH} removido. Aguardando recriação.`);
                 lastFileSize = 0;
            }
        });
         console.log('[logWatcher] Monitoramento fs.watchFile configurado.');
    } catch (watchErr) {
         console.error('[logWatcher] Erro CRÍTICO ao iniciar fs.watchFile:', watchErr);
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

     // Função para parar o watcher
     function stopWatching() {
         if (watchListener) {
             fs.unwatchFile(LOG_FILE_PATH, watchListener);
             console.log('[logWatcher] Monitoramento parado.');
         }
     }

    return {
        watcher: { stop: stopWatching },
        setLastFeedback,
        getIsSaleActive
    };
}

module.exports = { startWatching };