# Retorna o título da janela atualmente em foreground via P/Invoke (escreve o título ou nada)
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class User32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern int GetWindowTextLength(IntPtr hWnd);
}
"@ -ErrorAction Stop

try {
    $hWnd = [User32]::GetForegroundWindow()
    if ($hWnd -eq [IntPtr]::Zero) { exit 0 }
    $len = [User32]::GetWindowTextLength($hWnd)
    if ($len -le 0) { exit 0 }
    $sb = New-Object System.Text.StringBuilder ($len + 1)
    [User32]::GetWindowText($hWnd, $sb, $sb.Capacity) | Out-Null
    $title = $sb.ToString().Trim()
    if ($title) { Write-Output $title; exit 0 } else { exit 0 }
} catch {
    exit 0
}