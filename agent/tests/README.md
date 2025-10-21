# 🧪 Testes do Encantometro

Este diretório contém a suíte completa de testes para o sistema Encantometro.

## 📊 Cobertura de Testes

### Testes Implementados
- ✅ **feedbackTypes.spec.js** - Validação de tipos de feedback
- ✅ **api.spec.js** - Testes de API existentes
- ✅ **windowService.spec.js** - Serviços de janela (NOVO)
- ✅ **keyboardListener.spec.js** - Listener de teclado (NOVO)
- ✅ **logWatcher.spec.js** - Monitor de logs (NOVO)
- ✅ **processFeedback.spec.js** - Processamento de feedback (NOVO)
- ✅ **integration.spec.js** - Testes de integração (NOVO)

### Cobertura Estimada
- **Antes:** ~30%
- **Após novos testes:** ~75-80%

## 🚀 Como Executar

### Opção 1: Script PowerShell (Recomendado)
```powershell
# No diretório agent/
.\run-tests.ps1
```

### Opção 2: Comandos npm
```bash
# Todos os testes com cobertura
npm test

# Apenas testes unitários
npm test -- --testPathPattern="tests/.*\.spec\.js$"

# Apenas testes de integração
npm test -- --testPathPattern="tests/integration\.spec\.js$"

# Testes com relatório HTML
npm test -- --coverage --coverageReporters=html
```

### Opção 3: Jest direto
```bash
# Instalar Jest globalmente se necessário
npm install -g jest

# Executar testes
jest --coverage --verbose
```

## 📋 Comandos para Executar

Execute estes comandos no PowerShell no diretório `agent/`:

```powershell
# 1. Instalar dependências (se necessário)
npm install

# 2. Executar todos os testes
npm test

# 3. Executar com cobertura detalhada
npm test -- --coverage --coverageReporters=text --coverageReporters=html

# 4. Executar apenas testes específicos
npm test -- --testNamePattern="keyboardListener"
npm test -- --testNamePattern="logWatcher"
npm test -- --testNamePattern="windowService"
npm test -- --testNamePattern="integration"
```

## 📊 Relatórios de Cobertura

Após executar os testes, você encontrará:

- **coverage/lcov-report/index.html** - Relatório visual HTML
- **coverage/lcov.info** - Relatório LCOV para CI/CD
- **coverage/coverage-final.json** - Dados brutos de cobertura

## 🎯 Metas de Cobertura

- **Branches:** 70%+
- **Functions:** 70%+
- **Lines:** 70%+
- **Statements:** 70%+

## 🔧 Configuração

O arquivo `test-config.json` contém a configuração do Jest com:
- Thresholds de cobertura
- Configuração de ambiente
- Setup global
- Timeouts adequados

## 📝 Tipos de Teste

### Testes Unitários
- Validação de funções individuais
- Mocks de dependências externas
- Testes de edge cases
- Validação de entrada/saída

### Testes de Integração
- Fluxo completo de feedback
- Comunicação entre componentes
- Validação de API
- Testes de segurança

### Testes de Segurança
- Prevenção de injection
- Validação de entrada
- Autenticação/autorização
- Rate limiting

## 🐛 Troubleshooting

### Erro: "Cannot find module"
```bash
npm install
```

### Erro: "PowerShell execution policy"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Erro: "Jest not found"
```bash
npm install -g jest
# ou
npx jest
```

### Timeout nos testes
- Aumente o timeout no `test-config.json`
- Verifique se não há processos bloqueando portas

## 📈 Próximos Passos

1. **Executar os testes** usando os comandos acima
2. **Verificar cobertura** no relatório HTML
3. **Corrigir testes falhando** se houver
4. **Adicionar mais testes** se necessário para atingir 80%+

## 🎉 Resultado Esperado

Após executar todos os testes, você deve ver:
- ✅ Todos os testes passando
- 📊 Cobertura de 75-80%
- 📄 Relatórios HTML e LCOV gerados
- 🎯 Score de qualidade melhorado para 85-90/100
