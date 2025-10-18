# Script seguro para focar janela do PDV pelo título (caso encontre janela cujo título contenha o texto fornecido).
# Uso seguro: powershell.exe -File .\refocusPdv.ps1 --title "Meu PDV"
# Retornos:
#   0 = sucesso
#   1 = argumento inválido
#   2 = janela não encontrada
#   3 = falha ao trazer janela para foreground

# Parse manual de argumentos para aceitar '--title' ou '-title' (chamado do Node usa '--title')
param(
    [string]$title
)

# obter valor de --title / -title se passado via $args
if (-not $title) {
    for ($i = 0; $i -lt $args.Length; $i++) {
        if ($args[$i] -in @('--title','-title','title')) {
            if ($i + 1 -lt $args.Length) {
                $title = $args[$i + 1]
                break
            }
        }
    }
}

$title = $title -as [string]
if (-not $title) {
    Write-Error "Parâmetro --title é obrigatório."
    exit 1
}

$title = $title.Trim()
if ($title.Length -eq 0 -or $title.Length -gt 200) {
    Write-Error "Título inválido (vazio ou muito longo)."
    exit 1
}

# Limite simples para evitar injeção por composição (não executar comandos arbitrários neste script).
# O script apenas busca janelas cujo título contenha a string fornecida (comparação case-insensitive).

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class User32 {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@ -ErrorAction Stop

$foundHandle = [IntPtr]::Zero
$lcTitle = $title.ToLowerInvariant()

[User32]::EnumWindows(
    { param($hWnd, $lParam)
        try {
            if (-not [User32]::IsWindowVisible($hWnd)) { return $true }
            $len = [User32]::GetWindowTextLength($hWnd)
            if ($len -le 0) { return $true }
            $sb = New-Object System.Text.StringBuilder ($len + 1)
            [User32]::GetWindowText($hWnd, $sb, $sb.Capacity) | Out-Null
            $w = $sb.ToString()
            if ($w.ToLowerInvariant().Contains($lcTitle)) {
                $script:foundHandle = $hWnd
                return $false  # parar enumeração
            }
        } catch { }
        return $true
    }, [IntPtr]::Zero
)

if ($foundHandle -eq [IntPtr]::Zero) {
    Write-Output "Nenhuma janela encontrada com título contendo: '$title'"
    exit 2
}

# Tentar mostrar e trazer para foreground
$SW_SHOW = 5
[User32]::ShowWindow($foundHandle, $SW_SHOW) | Out-Null
$ok = [User32]::SetForegroundWindow($foundHandle)

if ($ok) {
    Write-Output "Janela focada com sucesso para título contendo: '$title'"
    exit 0
} else {
    Write-Error "Falha ao definir a janela como foreground."
    exit 3
}