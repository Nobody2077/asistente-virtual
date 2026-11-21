@echo off
REM ==================================================================
REM  TAMI - orientadora virtual de UNIFRANZ
REM  Enciende las 4 piezas en orden y abre a Tami en el escritorio:
REM   1. Cerebro: LM Studio con qwen3.5-9b (1 ranura = usa su cache)
REM   2. Memoria de Unifranz: cerebro\servidor_tami.py  (puerto 8766)
REM   3. Voz: voz\servidor_voz.py con Kokoro           (puerto 8767)
REM   4. Tami: Electron (src\tami\main.js)
REM ==================================================================
title Tami - Unifranz
set "T=%~dp0"
set "R=%T%..\"
set "LMS=%USERPROFILE%\.lmstudio\bin\lms.exe"
set "TAMI_SEDE=El Alto"

echo [1/4] Cerebro (LM Studio + Qwen3.5-9B)...
"%LMS%" server start >nul 2>&1
"%LMS%" ps 2>nul | findstr /c:"qwen/qwen3.5-9b" >nul
if errorlevel 1 (
    echo       Cargando el modelo en la tarjeta de video, unos 90 segundos...
    "%LMS%" load qwen/qwen3.5-9b --context-length 8192 --gpu max --parallel 1 -y >nul
)

echo [2/4] Memoria de Unifranz (Chroma)...
curl -sf http://127.0.0.1:8766/estado >nul 2>&1 || (
    set "PYTHONPATH=%R%windows\libs;%R%windows\rag_libs"
    set "PYTHONNOUSERSITE=1"
    start "Tami - memoria" /min "%R%windows\python\python.exe" "%T%cerebro\servidor_tami.py"
)

echo [3/4] Voz (Kokoro)...
REM la voz usa otro Python (3.13, voz\.venv): sin las librerias del portatil
set "PYTHONPATH="
curl -sf http://127.0.0.1:8767/estado >nul 2>&1 || (
    start "Tami - voz" /min "%T%voz\.venv\Scripts\python.exe" -u "%T%voz\servidor_voz.py"
)

echo       Esperando a que la memoria y la voz esten listas...
set /a n=0
:esperar
REM ping espera ~1 s; timeout falla si la ventana no tiene teclado
ping -n 2 127.0.0.1 >nul
set /a n+=1
curl -sf http://127.0.0.1:8767/estado >nul 2>&1 || (if %n% lss 90 goto esperar)
curl -s http://127.0.0.1:8766/estado 2>nul | findstr /c:"true" >nul || (if %n% lss 90 goto esperar)
if %n% geq 90 (
    echo [ERROR] La memoria o la voz no arrancaron. Mira las ventanas minimizadas "Tami - ...".
    pause
    exit /b 1
)

echo [4/4] Abriendo a Tami...
cd /d "%T%"
call npx electron src\tami\main.js
