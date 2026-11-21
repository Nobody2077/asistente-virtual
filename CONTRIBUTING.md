# Cómo trabajamos los dos (Juan y Brayan)

Regla de oro: **`main` siempre funciona.** Lo que está en `main` es lo que se presenta en la feria.

## El ciclo de cada cambio

```bash
git switch main
git pull                          # 1. traer lo último del otro
git switch -c brayan/ficha-qr     # 2. rama nueva: <quién>/<qué>
# ... programar y probar ...
git add <archivos>
git commit -m "Ficha QR: muestra la sede"   # 3. commits chicos, en español
git push -u origin brayan/ficha-qr          # 4. subir la rama
gh pr create --fill                         # 5. Pull Request en GitHub
```

6. El **otro** revisa el Pull Request (lee el cambio y, si puede, lo prueba) y lo une a `main`.
7. Los dos hacen `git switch main && git pull`.

## Para no pisarnos

- **Repartirse por carpetas.** Si uno está en `src/tami/` (cuerpo) y el otro en `cerebro/` (memoria), casi nunca
  hay conflicto. Avisen por WhatsApp antes de tocar `src/main/tami.js`: es el archivo que más cambia.
- **`git pull` antes de empezar** cada sesión.
- **Ramas cortas:** unir en el mismo día. Una rama de una semana = conflictos seguros.
- Si hay conflicto: no entrar en pánico. Abrir el archivo, buscar `<<<<<<<`, decidir juntos qué queda.

## Antes de pedir que unan tu rama

- [ ] `node scripts/probar-tami.js` responde bien.
- [ ] Si tocaste respuestas: `node scripts/examen-feria.js` no empeoró.
- [ ] Si tocaste el modo feria: `npx electron scripts/probar-feria.js` → TODO BIEN.
- [ ] Anotaste en `DOCUMENTACION.md` qué cambió y por qué (sección 5 o «DÓNDE NOS QUEDAMOS»).

## Qué NUNCA se sube

- Modelos, `motor/`, `voz/kokoro`, `voz/whisper`, `.venv` (pesan GB; ya están en `.gitignore`).
- Contraseñas, tokens o claves (`.env`).
- Datos personales de estudiantes de la feria (nombres, celulares, grabaciones).

Si `git status` muestra algo enorme o raro, **preguntar antes de hacer `git add .`**.

## Semana de la feria (hasta el 25/11)

Del **martes 24 a las 18:00** en adelante: **congelado.** Solo se unen arreglos de errores, nada nuevo.
