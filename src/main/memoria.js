'use strict';

// Her memory as Markdown you can read and edit by hand, in the folder CAPRI_MEMORIA points to
// (the USB's memoria\, see INICIAR_CAPRI.bat), else memoria\ in her data folder:
//   memoria.md                       what you asked her to remember ("recuerda que…"), one "- " line each
//   conversaciones\AAAA-MM-DD.md     what you said and what she answered, day by day

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const HEADER = '# Memoria de Capri\n\n'
  + 'Lo que le pediste recordar. Puedes editar este archivo a mano: una línea con "- " por recuerdo.\n\n'
  + '## Recuerdos\n\n';

const dir = () => process.env.CAPRI_MEMORIA || path.join(app.getPath('userData'), 'memoria');
const file = () => path.join(dir(), 'memoria.md');

// Her memories from memoria.md, or null when there's no file yet (config.json's are used then).
function read() {
  let text;
  try {
    text = fs.readFileSync(file(), 'utf8');
  } catch {
    return null;
  }
  return text.split(/\r?\n/).map((l) => /^\s*[-*]\s+(.+)$/.exec(l)?.[1].trim()).filter(Boolean);
}

function write(memories) {
  try {
    fs.mkdirSync(dir(), { recursive: true });
    fs.writeFileSync(file(), HEADER + memories.map((m) => `- ${m}`).join('\n') + (memories.length ? '\n' : ''));
  } catch (err) {
    console.error('[capri] could not save memoria.md:', err.message);
  }
}

// One exchange of her chat, added to today's file: her answer as she said it, without her tags
// ([[open: …]]) or a reasoning block, like chat.js shows it.
function log(said, raw) {
  const answer = String(raw)
    .replace(/<think>[\s\S]*?(<\/think>|$)/g, '')
    .replace(/\[\[[^\]]*(\]\]|$)/g, '')
    .trim() || '…';
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const folder = path.join(dir(), 'conversaciones');
  const target = path.join(folder, `${day}.md`);
  try {
    fs.mkdirSync(folder, { recursive: true });
    const head = fs.existsSync(target) ? '' : `# Conversación con Capri, ${day}\n\n`;
    fs.appendFileSync(target, `${head}**Tú (${time}):** ${said}\n\n**Capri:** ${answer}\n\n`);
  } catch (err) {
    console.error('[capri] could not save the conversation:', err.message);
  }
}

module.exports = { read, write, log, dir };
