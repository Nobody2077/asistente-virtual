'use strict';

// Notes you dictate to her in her chat ("capri toma nota" … "listo capri"), one Markdown file each,
// ready for Obsidian (or any Markdown app): front matter with the date, the time and tags, then the text.
// Folder: CAPRI_NOTAS, else notas\ next to the USB's memoria\ (CAPRI_MEMORIA, see INICIAR_CAPRI.bat),
// else notas\ in her data folder.

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

function dir() {
  if (process.env.CAPRI_NOTAS) return process.env.CAPRI_NOTAS;
  if (process.env.CAPRI_MEMORIA) return path.join(path.dirname(process.env.CAPRI_MEMORIA), 'notas');
  return path.join(app.getPath('userData'), 'notas');
}

const pad = (n) => String(n).padStart(2, '0');

// The model's first line, without a reasoning block.
function firstLine(raw) {
  const text = String(raw || '').replace(/<think>[\s\S]*?(<\/think>|$)/g, '');
  return text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
}

// A title made safe for a file name on Windows and FAT32 (and short), or '' if nothing is left of it.
function safeTitle(raw) {
  return firstLine(raw)
    .replace(/^(t[ií]tulo|title)\s*:\s*/i, '')
    .replace(/[\\/:*?"<>|#^[\]{}_]/g, ' ')
    .replace(/(\p{L})-(?=\p{L})/gu, '$1 ') // "capri-leer-notas", as small models write it
    .replace(/^[\s"'“”«»`.\-–—*]+|[\s"'“”«»`.!?,;\-–—*]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim();
}

// Writes the note. lines: what you said, one message each. Resolves with { file, name }.
function save({ title, lines, at = new Date() }) {
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const name = safeTitle(title) || `nota ${pad(at.getHours())}${pad(at.getMinutes())}`;
  const folder = dir();
  fs.mkdirSync(folder, { recursive: true });
  let base = `${day} ${name}`;
  for (let i = 2; fs.existsSync(path.join(folder, `${base}.md`)); i++) base = `${day} ${name} (${i})`;
  const file = path.join(folder, `${base}.md`);
  const heading = name.charAt(0).toUpperCase() + name.slice(1);
  const body = lines.map((l) => `- ${String(l).trim()}`).join('\n');
  const text = `---\nfecha: ${day}\nhora: "${time}"\ntags: [capri, nota]\n---\n\n# ${heading}\n\n${body}\n`;
  fs.writeFileSync(file, text, 'utf8');
  return { file, name: `${base}.md` };
}

module.exports = { save, safeTitle, dir };
