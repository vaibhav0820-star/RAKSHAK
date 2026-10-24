@echo off
setlocal
title SafeHaven training
cd /d "%~dp0"
echo.
echo ===== SafeHaven: train the assistant on this PC (NVIDIA GPU needed) =====
echo.
where python >nul 2>nul
if errorlevel 1 goto nopython
where node >nul 2>nul
if errorlevel 1 goto nonode
nvidia-smi >nul 2>nul
if errorlevel 1 goto nogpu

echo [1/7] Building training data...
node tools\make-training.js
if errorlevel 1 goto fail

echo [2/7] Python environment...
if not exist training\venv python -m venv training\venv
call training\venv\Scripts\activate.bat
python -c "import torch" >nul 2>nul
if errorlevel 1 (
  echo Installing PyTorch with CUDA ^(about 2.5 GB, first time only^)...
  pip install torch --index-url https://download.pytorch.org/whl/cu124
  if errorlevel 1 goto fail
)
pip install -q "transformers>=4.46" peft datasets accelerate sentencepiece protobuf gguf numpy
if errorlevel 1 goto fail

echo [3/7] Training ^(10 to 60 minutes, downloads the 1.5B base model the first time^)...
python training\train_local.py
if errorlevel 1 goto fail

echo [4/7] Getting the llama.cpp converter...
if exist training\llama.cpp-master goto haveconv
curl -L --fail -o training\llama.zip https://github.com/ggml-org/llama.cpp/archive/refs/heads/master.zip
if errorlevel 1 goto fail
tar -xf training\llama.zip -C training
:haveconv

echo [5/7] Converting to GGUF...
python training\llama.cpp-master\convert_hf_to_gguf.py training\out\merged --outfile training\out\safehaven-q8.gguf --outtype q8_0
if errorlevel 1 goto fail

echo [6/7] Importing into Ollama as safehaven-ft...
where ollama >nul 2>nul || set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama"
ollama create safehaven-ft -f training\Modelfile.ft
if errorlevel 1 goto fail

echo [7/7] Quick test...
ollama run safehaven-ft "she is bleeding heavily after giving birth"
echo.
echo Done. START-SAFEHAVEN.bat will now use safehaven-ft automatically.
pause
exit /b

:nopython
echo Python is missing. Install Python 3.10 to 3.12 from https://www.python.org ^(tick "Add python.exe to PATH"^), then run this again.
pause
exit /b
:nonode
echo Node.js is missing. Run START-SAFEHAVEN.bat first.
pause
exit /b
:nogpu
echo No NVIDIA GPU or driver found ^(nvidia-smi failed^). Install the latest NVIDIA driver, or train on Google Colab instead.
pause
exit /b
:fail
echo.
echo Something failed. Read the message above, fix it, and run this file again ^(finished steps are skipped or quick^).
pause
exit /b
