# CONFIGURACION PERSONAL DE TAMI (Linux). Igual que config_local.ejemplo.bat.
#   cp config_local.ejemplo.sh config_local.sh    y descomenta UNA opcion.
# config_local.sh NO se sube a git. Sin el, Tami usa llama-server + Qwen3.5-9B.

# --- Opcion A: Ollama (puerto 11434). Antes: ollama pull qwen2.5:7b
# export TAMI_LLM_URL="http://127.0.0.1:11434/v1"
# export TAMI_MODELO="qwen2.5:7b"

# --- Opcion B: LM Studio (puerto 1234), con "Start Server" activado
# export TAMI_LLM_URL="http://127.0.0.1:1234/v1"
# export TAMI_MODELO="nombre-que-muestra-lm-studio"

# --- Opcion C: tu propio llama-server en otro puerto
# export TAMI_LLM_URL="http://127.0.0.1:8081/v1"
# export TAMI_MODELO="mi-modelo"

# --- Opcional
# export TAMI_SEDE="El Alto"
