# Script para executar testes do Encantometro
# Execute este script no PowerShell para rodar todos os testes

Write-Host "🧪 EXECUTANDO TESTES DO ENCANTOMETRO" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Verifica se está no diretório correto
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erro: Execute este script no diretório agent/" -ForegroundColor Red
    exit 1
}

# Verifica se node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao instalar dependências" -ForegroundColor Red
        exit 1
    }
}

Write-Host "🔍 Executando testes unitários..." -ForegroundColor Green
npm test -- --testPathPattern="tests/.*\.spec\.js$" --coverage --verbose

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Testes unitários passaram!" -ForegroundColor Green
} else {
    Write-Host "❌ Alguns testes unitários falharam" -ForegroundColor Red
}

Write-Host "`n🔗 Executando testes de integração..." -ForegroundColor Green
npm test -- --testPathPattern="tests/integration\.spec\.js$" --verbose

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Testes de integração passaram!" -ForegroundColor Green
} else {
    Write-Host "❌ Alguns testes de integração falharam" -ForegroundColor Red
}

Write-Host "`n📊 Gerando relatório de cobertura..." -ForegroundColor Green
npm test -- --coverage --coverageReporters=text --coverageReporters=html

Write-Host "`n📈 RESUMO DOS TESTES:" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan

# Verifica se o relatório de cobertura foi gerado
if (Test-Path "coverage/lcov-report/index.html") {
    Write-Host "📄 Relatório HTML gerado em: coverage/lcov-report/index.html" -ForegroundColor Yellow
}

if (Test-Path "coverage/lcov.info") {
    Write-Host "📄 Relatório LCOV gerado em: coverage/lcov.info" -ForegroundColor Yellow
}

Write-Host "`n🎯 Para visualizar o relatório de cobertura:" -ForegroundColor Cyan
Write-Host "   Abra o arquivo: coverage/lcov-report/index.html" -ForegroundColor White

Write-Host "`n✨ Testes concluídos!" -ForegroundColor Green
