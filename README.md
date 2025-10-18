# Atendimento Agent — Projeto

Resumo
- Agente para captura de feedback em PDV, com servidor HTTP para coleta.
- Arquitetura em camadas: domain / application / infrastructure.
- Mitigações de segurança aplicadas (listener opt‑in, validação, autenticação via API key e rate limiter).
- Testes iniciais com Jest + supertest; scripts e exemplos incluídos.

Índice
- Requisitos
- Instalação
- Configuração (desenvolvimento)
- Executando
- Testes
- Estrutura do projeto
- Segurança / Privacidade
- Boas práticas de desenvolvimento
- Contribuição
- Licença

Requisitos
- Node.js >= 16
- Windows (algumas funcionalidades usam APIs/PowerShell)
- npm

Instalação (desenvolvimento)
PowerShell:
```powershell
cd C:\atendimento\agent
npm install
```

Configuração
- Variáveis de ambiente (servidor):
  - Crie `c:\atendimento\server\.env` ou exporte em sessão:
    - API_KEY — chave para proteger endpoints
    - RATE_WINDOW_MS — janela do rate limiter (ms), ex: 60000
    - RATE_LIMIT_MAX — limites por janela, ex: 60
- Exemplo já incluído: `server/.env.example`
- Para desenvolvimento local, há `agent/scripts/*.ps1` usados por windowService; não comitar segredos.

Executando
- Rodar servidor:
```powershell
cd C:\atendimento\server
# exporte API_KEY na mesma sessão ou use .env
node server.js
```
- Rodar agente (cliente):
```powershell
cd C:\atendimento\agent
npm start
```

Testes
- Testes unitários e integração com Jest:
```powershell
cd C:\atendimento\agent
npm test --silent
```
- Observações:
  - supertest é usado para testes HTTP em memória quando aplicável.
  - Ajuste timeouts se necessário (tests/api.spec.js START_TIMEOUT).

Estrutura do projeto (resumo)
- /agent
  - src/
    - domain/        (validações e regras)
    - application/   (casos de uso — processFeedback)
    - infrastructure/
      - listeners/   (keyboardListener)
      - services/    (windowService, requestRefocus, feedbackService)
  - scripts/         (PowerShell helpers: refocusPdv.ps1, getActiveWindowTitle.ps1)
  - tests/           (Jest)
- /server
  - server.js        (API express para /api/feedback)
  - .env.example

Segurança e Privacidade (importante)
- Keyboard listener está desativado por padrão. Ative explicitamente via config (enable_keyboard_listener=true) só após revisão de privacidade/legal.
- API protegida por header `x-api-key`. Nunca comitar chaves em repositório.
- Não logar conteúdo de teclas, nem armazenar texto sensível.
- Em produção:
  - Use secrets manager (Key Vault, Secrets Manager) em vez de .env.
  - Substitua rate limiter em memória por Redis-backed (scale).
  - Considere autenticação mais robusta (OAuth/JWT).

Melhorias recomendadas
- Persistência: migrar de memória para SQLite/Postgres.
- Queue/Workers: usar BullMQ/Redis para operações pesadas (refocus/coalescing).
- Logger: usar winston ou pino (evitar console.log).
- CI: adicionar workflow (GitHub Actions) para lint, test, audit.
- Auditoria de dependências: `npm audit` e correções periódicas.

Como ativar o listener (cautela)
1. Revise política de privacidade e obtenha consentimento.
2. Em `agent/config.json` ou variáveis, definir:
```json
{
  "enable_keyboard_listener": true,
  "keyboard_debounce_ms": 300
}
```
3. Reinicie agente. Monitorar logs e comportamento.

Troubleshooting rápido
- Porta 3000 ocupada -> pare processo ou altere porta no servidor.
- Erro ao rodar scripts PowerShell -> execute com `-ExecutionPolicy Bypass` na chamada se necessário (avaliar riscos).
- Testes falhando por porta -> prefira supertest / ajustes nos testes para usar instância express em memória.

Contribuição
- Fork → branch → PR
- Siga padrões: lint, tests, documente mudanças.
- Antes de PR: rodar `npm test` e `npm audit`.

Contato / Referências
- Arquivos principais: `server/server.js`, `agent/src/*`, `agent/scripts/*`, `agent/tests/*`
- Para dúvidas ou automações adicionais, abra issue/PR.

Licença
- MIT (defina explicitamente se necessário).