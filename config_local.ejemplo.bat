@echo off
REM ==================================================================
REM  CONFIGURACION PERSONAL DE TAMI
REM  1. Copia este archivo como  config_local.bat  (misma carpeta).
REM  2. Descomenta (borra el REM) UNA de las opciones de abajo.
REM  config_local.bat NO se sube a git: cada uno tiene el suyo.
REM  Sin config_local.bat, Tami usa llama-server + Qwen3.5-9B (la PC de la feria).
REM ==================================================================

REM --- Opcion A: Ollama (puerto 11434). Antes: ollama pull qwen2.5:7b
REM set "TAMI_LLM_URL=http://127.0.0.1:11434/v1"
REM set "TAMI_MODELO=qwen2.5:7b"

REM --- Opcion B: LM Studio (puerto 1234). Activar "Start Server" en LM Studio.
REM set "TAMI_LLM_URL=http://127.0.0.1:1234/v1"
REM set "TAMI_MODELO=nombre-del-modelo-que-muestra-lm-studio"

REM --- Opcion C: tu propio llama-server en otro puerto
REM set "TAMI_LLM_URL=http://127.0.0.1:8081/v1"
REM set "TAMI_MODELO=mi-modelo"

REM --- Opcional: la sede del stand
REM set "TAMI_SEDE=El Alto"
