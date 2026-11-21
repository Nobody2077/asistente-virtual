#!/usr/bin/env bash
# TAMI en MODO FERIA (Linux): pantalla completa blindada. Igual que TAMI_FERIA.bat.
# Minimizar: mantener 1 s el boton de arriba a la derecha o Ctrl+Alt+Shift+M
# SALIDA SECRETA: Ctrl+Alt+Shift+Q
exec bash "$(dirname "${BASH_SOURCE[0]}")/INICIAR_TAMI.sh" --stand --feria "$@"
