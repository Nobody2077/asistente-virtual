# Tami nació de Capri

Tami empezó como una copia de **[Capri](https://github.com/mochiiwuff/capri-desktop)**, una asistente de
escritorio hecha por **mochiiwuff**. Los primeros 105 commits del historial son su trabajo.

**Qué queda de Capri en Tami:**

| Archivo | Qué hace |
|---|---|
| `src/main/llm.js` | habla con el modelo de lenguaje (llama-server, LM Studio, Ollama o cualquier servidor compatible con OpenAI) y entrega la respuesta palabra por palabra |
| `src/main/ollama.js` | conexión con Ollama |

Todo lo demás (el avatar, la voz, la memoria de Unifranz, la personalidad, el modo feria) es de Tami.
La interfaz pixel-art de Capri, sus hooks de Claude Code y su instalador se quitaron el 21/11/2026
porque Tami no los usaba. Siguen en el historial de git, por si alguna vez hacen falta.

**Licencia:** Capri se publica con **PolyForm Noncommercial 1.0.0** ([`LICENSE`](LICENSE)), y esa licencia
sigue valiendo para este proyecto: se puede usar, cambiar y compartir **sin fines comerciales**.

Required Notice: Copyright (c) 2026 mochiiwuff (https://github.com/mochiiwuff/capri-desktop)
