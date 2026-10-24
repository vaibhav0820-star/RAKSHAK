@echo off
setlocal
title RAKSHAK Emergency Platform Launcher
cd /d "%~dp0"
echo.
echo ========================================================
echo   RAKSHAK: Zero-Internet Emergency Mesh Platform
echo   Primary Model: gemma4:e2b (Local Ollama Engine)
echo ========================================================
echo.

rem ---------- 1. Node.js ----------
where node >nul 2>nul
if errorlevel 1 goto nonode
echo [1/6] Node.js found.
goto ollama

:nonode
echo [1/6] Node.js is missing. Downloading Node.js LTS from nodejs.org...
powershell -NoProfile -Command "try { $u='https://nodejs.org/dist/latest-v22.x/'; $t=(Invoke-WebRequest -UseBasicParsing ($u+'SHASUMS256.txt')).Content; $f=[regex]::Match($t,'node-v[\d\.]+-x64\.msi').Value; Invoke-WebRequest -UseBasicParsing ($u+$f) -OutFile $env:TEMP\node-setup.msi; exit 0 } catch { exit 1 }"
if errorlevel 1 goto nodefail
echo Installing Node.js, accept permission prompt...
msiexec /i "%TEMP%\node-setup.msi" /passive
echo Node.js installed. Please run START-RAKSHAK.bat again.
pause
exit /b

:nodefail
echo Download failed. Please install Node.js LTS manually from https://nodejs.org
pause
exit /b

rem ---------- 2. Ollama ----------
:ollama
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama"
where ollama >nul 2>nul
if errorlevel 1 goto noollama
echo [2/6] Ollama local engine found.
goto gpu

:noollama
echo [2/6] Ollama is missing. Downloading installer from ollama.com...
curl -L --fail -o "%TEMP%\OllamaSetup.exe" https://ollama.com/download/OllamaSetup.exe
if errorlevel 1 goto ollamafail
echo Installing Ollama...
"%TEMP%\OllamaSetup.exe" /SILENT
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama"
where ollama >nul 2>nul
if errorlevel 1 goto ollamafail
goto gpu

:ollamafail
echo Could not install Ollama automatically. Download from https://ollama.com/download, install, then run this file again.
pause
exit /b

rem ---------- 3. GPU settings & weak laptop optimizations ----------
:gpu
where nvidia-smi >nul 2>nul
if errorlevel 1 (
  echo [3/6] Running on CPU (Optimized small context for weak laptop).
) else (
  echo [3/6] NVIDIA GPU detected. Ollama will accelerate gemma4:e2b.
  set CUDA_VISIBLE_DEVICES=0
)

set OLLAMA_FLASH_ATTENTION=1
set OLLAMA_KEEP_ALIVE=60m
set OLLAMA_NUM_PARALLEL=1

rem ---------- 4. Start Ollama and verify gemma4:e2b ----------
curl -s --connect-timeout 2 http://127.0.0.1:11434/api/tags >nul 2>nul
if not errorlevel 1 goto ollamaup
echo [4/6] Starting Ollama background engine...
start "Ollama" /min ollama serve
set /a tries=0

:waitollama
set /a tries+=1
ping -n 2 127.0.0.1 >nul
curl -s --connect-timeout 2 http://127.0.0.1:11434/api/tags >nul 2>nul
if not errorlevel 1 goto ollamaup
if %tries% lss 25 goto waitollama
echo Ollama start timed out. Continuing with offline rule-based fallback...
goto deps

:ollamaup
echo [4/6] Ollama running. Checking gemma4:e2b model...
ollama list | findstr /i "gemma4:e2b" >nul
if not errorlevel 1 goto modelready
echo Pulling gemma4:e2b model (first run only)...
ollama pull gemma4:e2b

:modelready
echo Creating RAKSHAK assistant model profile...
ollama create rakshak -f ai\Modelfile >nul 2>nul

rem ---------- 5. Dependencies and Firewall ----------
:deps
if exist node_modules goto deps_ok
echo [5/6] Installing dependencies...
call npm.cmd install
:deps_ok

netsh advfirewall firewall show rule name="RAKSHAK" >nul 2>nul
if not errorlevel 1 goto fw_ok
netsh advfirewall firewall add rule name="RAKSHAK" dir=in action=allow protocol=TCP localport=3000,3443 >nul 2>nul
:fw_ok

rem ---------- 6. Launch RAKSHAK Server ----------
echo [6/6] Launching RAKSHAK Emergency Platform...
set RAKSHAK_MODEL=gemma4:e2b
start "" cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:3000"
echo Server started. Keep this console window open. Press Ctrl+C to stop.
echo.
call npm.cmd start
pause
