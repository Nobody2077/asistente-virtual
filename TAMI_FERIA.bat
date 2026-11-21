@echo off
REM ==================================================================
REM  TAMI en MODO FERIA: pantalla completa con fondo de Unifranz,
REM  blindada (no se cierra con Alt+F4, Ctrl+Q, Ctrl+W ni la X).
REM  Enciende todo igual que INICIAR_TAMI.bat.
REM  MINIMIZAR: mantener 1 s el boton de arriba a la derecha, o Ctrl+Alt+Shift+M
REM  (volver: clic en Tami en la barra de tareas)
REM  SALIDA SECRETA: Ctrl+Alt+Shift+Q
REM ==================================================================
call "%~dp0INICIAR_TAMI.bat" --stand --feria
