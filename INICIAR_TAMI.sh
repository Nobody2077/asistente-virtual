#!/usr/bin/env bash
# ==================================================================
#  TAMI en Linux (x86_64: Ubuntu, Mint...). Equivale a INICIAR_TAMI.bat.
#  Uso:   bash INICIAR_TAMI.sh            (ventana normal)
#         bash INICIAR_TAMI.sh --stand    (pantalla completa)
#         bash TAMI_FERIA.sh              (modo feria blindado)
#  Enciende: cerebro (8080, o el tuyo), memoria (8766), voz (8767) y Electron.
#  Configuracion personal: config_local.sh (copia de config_local.ejemplo.sh).
# ==================================================================
set -u
T="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
R="$(dirname "$T")"                      # LLMLocalUnifranz/
L="$HOME/.llmlocal_unifranz"             # Python portatil de Linux (lo descomprime la 1.a vez)
export TAMI_SEDE="${TAMI_SEDE:-El Alto}"
export TAMI_MOTOR="${TAMI_MOTOR:-llamacpp}"
[ -f "$T/config_local.sh" ] && source "$T/config_local.sh"
export TAMI_LLM_URL="${TAMI_LLM_URL:-}" TAMI_MODELO="${TAMI_MODELO:-}"
[ -z "$TAMI_MODELO" ] && unset TAMI_MODELO

error() { echo "[ERROR] $1"; exit 1; }
responde() { curl -sf "$1" >/dev/null 2>&1; }
PIDS=()
apagar() { echo; echo "Apagando..."; for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done; }
trap apagar EXIT
mkdir -p "$T/capturas"

# ---------- 1. Cerebro ----------
if [ -n "$TAMI_LLM_URL" ]; then
    echo "[1/4] Cerebro propio: $TAMI_LLM_URL  modelo: ${TAMI_MODELO:-?}"
    URL_SALUD="$TAMI_LLM_URL/models"
else
    echo "[1/4] Cerebro (llama-server + Qwen3.5-9B)..."
    URL_SALUD="http://127.0.0.1:8080/health"
    if ! responde "$URL_SALUD"; then
        LS="$(command -v llama-server || ls "$T"/motor/*/llama-server 2>/dev/null | head -1)"
        [ -x "$LS" ] || error "No hay llama-server. Instala llama.cpp o usa tu modelo con config_local.sh (ver README)."
        [ -f "$T/modelos/Qwen3.5-9B-Q4_K_M.gguf" ] || error "Falta modelos/Qwen3.5-9B-Q4_K_M.gguf (o usa config_local.sh)."
        "$LS" -m "$T/modelos/Qwen3.5-9B-Q4_K_M.gguf" -c 8192 -ngl 99 -np 1 -fa auto --reasoning off \
            --cache-ram 1024 --no-webui --host 127.0.0.1 --port 8080 --alias qwen3.5-9b \
            > "$T/capturas/cerebro.log" 2>&1 &
        PIDS+=($!)
    fi
fi

# ---------- 2. Memoria de Unifranz ----------
echo "[2/4] Memoria de Unifranz (Chroma)..."
if ! responde http://127.0.0.1:8766/estado; then
    [ -f "$R/linux/python-linux.tar.gz" ] || error "Falta $R/linux (copia la carpeta LLMLocalUnifranz completa)."
    if ! cmp -s "$R/linux/VERSION" "$L/VERSION"; then
        echo "      Primera vez: descomprimiendo Python en $L (~1 min)..."
        rm -rf "$L"; mkdir -p "$L"
        tar -xzf "$R/linux/python-linux.tar.gz" -C "$L" && tar -xzf "$R/linux/libs-linux.tar.gz" -C "$L" \
            || error "No se pudo descomprimir (¿espacio en $HOME?)."
        cp "$R/linux/VERSION" "$L/VERSION"
    fi
    PYTHONPATH="$L/libs-linux" PYTHONNOUSERSITE=1 "$L/python/bin/python3" "$T/cerebro/servidor_tami.py" \
        > "$T/capturas/memoria.log" 2>&1 &
    PIDS+=($!)
fi

# ---------- 3. Voz ----------
echo "[3/4] Voz (Kokoro) y oido (Whisper)..."
if ! responde http://127.0.0.1:8767/estado; then
    PYV="$T/voz/.venv/bin/python"
    [ -x "$PYV" ] || error "Falta voz/.venv. Créalo:  cd voz && uv venv -p 3.13 .venv && uv pip install -p .venv -r requirements.txt"
    [ -f "$T/voz/kokoro/kokoro-v1.0.onnx" ] || error "Falta voz/kokoro/kokoro-v1.0.onnx (ver README)."
    "$PYV" -u "$T/voz/servidor_voz.py" > "$T/capturas/voz.log" 2>&1 &
    PIDS+=($!)
fi

echo "      Esperando a que todo este listo (logs en capturas/*.log)..."
for i in $(seq 1 150); do
    responde "$URL_SALUD" && responde http://127.0.0.1:8767/estado \
        && curl -s http://127.0.0.1:8766/estado 2>/dev/null | grep -q true && break
    [ "$i" = 150 ] && error "Algo no arrancó en 2,5 min. Mira capturas/cerebro.log, memoria.log y voz.log"
    sleep 1
done

# ---------- 4. Tami ----------
echo "[4/4] Abriendo a Tami..."
cd "$T" && npx electron src/tami/main.js "$@"
