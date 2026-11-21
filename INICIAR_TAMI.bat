@echo off
REM ==================================================================
REM  TAMI - orientadora virtual de UNIFRANZ
REM  Enciende las 4 piezas en orden y abre a Tami en el escritorio:
REM   1. Cerebro: llama-server (llama.cpp, Vulkan) + Qwen3.5-9B  (8080)
REM   2. Memoria de Unifranz: cerebro\servidor_tami.py           (8766)
REM   3. Voz: voz\servidor_voz.py con Kokoro                     (8767)
REM   4. Tami: Electron (src\tami\main.js)
REM  Ya NO necesita LM Studio (ver DOCUMENTACION.md).
REM ==================================================================
title Tami - Unifranz
set "T=%~dp0"
set "R=%T%..\"
set "TAMI_SEDE=El Alto"
set "TAMI_MOTOR=llamacpp"
set "TAMI_LLM_URL="
REM  Configuracion personal (cada uno la suya, NO va a git): copiar config_local.ejemplo.bat
if exist "%T%config_local.bat" call "%T%config_local.bat"
if defined TAMI_LLM_URL goto cerebro_propio

echo [1/4] Cerebro (llama-server + Qwen3.5-9B en la tarjeta de video)...
curl -sf http://127.0.0.1:8080/health >nul 2>&1 || (
    start "Tami - cerebro" /min "%T%motor\llama-b12198\llama-server.exe" -m "%T%modelos\Qwen3.5-9B-Q4_K_M.gguf" -c 8192 -ngl 99 -np 1 -fa auto --reasoning off --cache-ram 1024 --no-webui --host 127.0.0.1 --port 8080 --alias qwen3.5-9b
)
REM  -ngl 99 todo en la GPU / -np 1 una ranura (usa su cache) / --reasoning off sin modo pensamiento
REM  --cache-ram 1024: a lo sumo 1 GB de RAM para recordar prompts (por defecto eran 8 GB)
goto memoria

:cerebro_propio
echo [1/4] Cerebro propio: %TAMI_LLM_URL%  modelo: %TAMI_MODELO%
echo       (tiene que estar encendido: Ollama, LM Studio, etc.)

:memoria

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

echo       Esperando a que el cerebro, la memoria y la voz esten listos...
set /a n=0
:esperar
REM ping espera ~1 s; timeout falla si la ventana no tiene teclado
ping -n 2 127.0.0.1 >nul
set /a n+=1
if %n% geq 150 goto fallo
if defined TAMI_LLM_URL goto esperar_propio
curl -sf http://127.0.0.1:8080/health >nul 2>&1 || goto esperar
goto esperar_resto
:esperar_propio
curl -sf "%TAMI_LLM_URL%/models" >nul 2>&1 || goto esperar
:esperar_resto
curl -sf http://127.0.0.1:8767/estado >nul 2>&1 || goto esperar
curl -s http://127.0.0.1:8766/estado 2>nul | findstr /c:"true" >nul || goto esperar

echo [4/4] Abriendo a Tami...
cd /d "%T%"
REM  %* pasa las opciones: INICIAR_TAMI.bat --stand  = pantalla completa para la feria
call npx electron src\tami\main.js %*
exit /b 0

:fallo
echo [ERROR] Algo no arranco en 2,5 minutos. Mira las ventanas minimizadas "Tami - ...".
pause
exit /b 1
