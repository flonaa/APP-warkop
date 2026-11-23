@echo off
setlocal
title Warkop POS - Server
cd /d "%~dp0warkop-pos"

set PORT=8080
where python >nul 2>nul
if errorlevel 1 (
  echo Python tidak ditemukan. Pasang Python dari python.org lalu jalankan ulang.
  pause
  exit /b 1
)

rem Cari alamat IP jaringan lokal untuk dibuka dari HP di Wi-Fi yang sama.
set LANIP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  if not defined LANIP set LANIP=%%a
)
set LANIP=%LANIP: =%

echo ============================================
echo   WARKOP POS sedang berjalan
echo ============================================
echo   Komputer ini : http://localhost:%PORT%
if defined LANIP echo   HP (Wi-Fi sama): http://%LANIP%:%PORT%
echo.
echo   Tutup jendela ini untuk menghentikan server.
echo ============================================

start "" "http://localhost:%PORT%"
python -m http.server %PORT% --bind 0.0.0.0
