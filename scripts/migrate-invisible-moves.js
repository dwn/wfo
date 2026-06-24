#!/usr/bin/env node
/**
 * Migrate invisible moves from .l/.r/.u/.d to ⇠⇢⇡⇣ in current arrow-notation rules.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { toPathDigits, PATH_SEP } = require('./path-digits');
const INVISIBLE = { l: '⮜', r: '⮞', u: '⮝', d: '⮟', L: '⮜', R: '⮞', U: '⮝', D: '⮟' };

function lrudToSymbols(move, map) {
  let out = '';
  let i = 0;
  while (i < move.length) {
    const dir = move[i];
    if (!map[dir]) break;
    i++;
    let num = '';
    while (i < move.length && /\d/.test(move[i])) num += move[i++];
    out += map[dir] + toPathDigits(num || '1');
  }
  return out;
}

function migratePathString(pathStr) {
  let out = '';
  let i = 0;
  let needLineSep = false;
  let needInvSep = false;

  while (i < pathStr.length) {
    const c = pathStr[i];

    if (c === '.') {
      i++;
      let move = '';
      while (i < pathStr.length && /[lrudLRUD]/.test(pathStr[i])) {
        move += pathStr[i++];
        while (i < pathStr.length && /\d/.test(pathStr[i])) move += pathStr[i++];
      }
      if (needInvSep) out += PATH_SEP;
      out += lrudToSymbols(move, INVISIBLE);
      needInvSep = true;
      needLineSep = false;
      continue;
    }

    if (c === '⋅' || c === '⎹' || c === '|') {
      i++;
      needLineSep = true;
      needInvSep = true;
      continue;
    }

    if (c === '◖' || c === '◗') {
      out += c;
      i++;
      needInvSep = false;
      needLineSep = false;
      while (i < pathStr.length && '←→↑↓'.includes(pathStr[i])) {
        out += pathStr[i++];
        while (i < pathStr.length && /\d/.test(pathStr[i])) out += toPathDigits(pathStr[i++]);
      }
      continue;
    }

    if ('←→↑↓'.includes(c)) {
      if (needLineSep) out += PATH_SEP;
      needLineSep = false;
      needInvSep = false;
      while (i < pathStr.length && '←→↑↓'.includes(pathStr[i])) {
        out += pathStr[i++];
        while (i < pathStr.length && /\d/.test(pathStr[i])) out += toPathDigits(pathStr[i++]);
      }
      continue;
    }

    if ('⮜⮞⮝⮟'.includes(c)) {
      if (needInvSep) out += PATH_SEP;
      needInvSep = false;
      needLineSep = false;
      while (i < pathStr.length && '⮜⮞⮝⮟'.includes(pathStr[i])) {
        out += pathStr[i++];
        while (i < pathStr.length && /\d/.test(pathStr[i])) out += toPathDigits(pathStr[i++]);
      }
      continue;
    }

    if ('⯭^*∗Oo'.includes(c)) {
      out += c === '^' ? '⯭' : (c === '*' || c === '∗' ? '∗' : (c === 'O' || c === 'o' ? '⍛' : c));
      i++;
      needLineSep = false;
      needInvSep = false;
      continue;
    }

    out += c;
    i++;
  }

  return out;
}

function migrateGlyphLine(line) {
  if (line.trim().startsWith('//')) return line;

  let prefix = '';
  let body = line;
  let suffix = '';

  const leadUse = line.match(/^(\{use_rule\s+\d+\.\d+\}\n?)/);
  if (leadUse) {
    prefix = leadUse[1];
    body = line.slice(prefix.length);
  }
  const trailUse = body.match(/(\n?\{use_rule\s+\d+\.\d+\})$/);
  if (trailUse) {
    suffix = trailUse[1];
    body = body.slice(0, -suffix.length);
  }

  const parts = body.split('⌇');
  const converted = parts.map((seg) => {
    const comma = seg.indexOf(',');
    if (comma <= 0) return seg;
    return seg.slice(0, comma + 1) + migratePathString(seg.slice(comma + 1));
  });

  return prefix + converted.join('⌇') + suffix;
}

function migrateRule14(rule) {
  const header =
    '// Path notation → hex. ⮞𝟮⮝𝟭 invisible — ←𝟮⋅↓𝟭 sequential — ←𝟮↑𝟭 diagonal — ◖→𝟮↑𝟭 arc h — ◗→𝟮↑𝟭 arc v';
  const seen = new Map();
  const items = [];

  for (const line of rule.split('\n')) {
    if (line.trim().startsWith('//')) continue;
    for (const item of line.trim().split(/\s+/)) {
      if (!item.includes(',')) continue;
      const idx = item.indexOf(',');
      const source = migratePathString(item.slice(0, idx));
      const target = item.slice(idx + 1);
      if (!seen.has(source)) {
        seen.set(source, target);
        items.push(`${source},${target}`);
      }
    }
  }

  return `${header}\n${items.join(' ')}`;
}

function updateCard(filename) {
  const filePath = path.join(ROOT, filename);
  const card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!card.rule) return;
  card.rule = card.rule.split('\n').map(migrateGlyphLine).join('\n');
  fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n');
}

const card04Path = path.join(ROOT, 'public/card/0.4.json');
const card04 = JSON.parse(fs.readFileSync(card04Path, 'utf8'));
card04.rule = migrateRule14(card04.rule);
fs.writeFileSync(card04Path, JSON.stringify(card04, null, 2) + '\n');
console.log('Updated public/card/0.4.json');

for (const f of ['public/card/0.2.json', 'public/card/0.1.json', 'public/card/0.5.json']) {
  updateCard(f);
  console.log('Updated', f);
}
