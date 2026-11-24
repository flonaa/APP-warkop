@echo off
setlocal
title Warkop HCR - Server

where.exe python >nul 2>nul
if errorlevel 1 (
  echo Python tidak ditemukan. Pasang Python 3 lalu jalankan ulang.
  pause
  exit /b 1
)

python "%~dp0tools\serve-warkop.py"
if errorlevel 1 (
  pause
  exit /b 1
)
