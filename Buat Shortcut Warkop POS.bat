@echo off
setlocal
set "WARKOP_SHORTCUT_TARGET=%~dp0Jalankan Warkop POS.bat"
powershell.exe -NoProfile -Command "$ErrorActionPreference = 'Stop'; $target = $env:WARKOP_SHORTCUT_TARGET; if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw 'Peluncur Warkop POS tidak ditemukan.' }; $desktop = [Environment]::GetFolderPath('DesktopDirectory'); $path = Join-Path $desktop 'Warkop POS.lnk'; $shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut($path); $shortcut.TargetPath = $target; $shortcut.WorkingDirectory = Split-Path -LiteralPath $target; $shortcut.Description = 'Jalankan aplikasi kasir Warkop HCR'; $shortcut.Save(); Write-Host ('Shortcut dibuat: ' + $path)"
if errorlevel 1 (
  pause
  exit /b 1
)
