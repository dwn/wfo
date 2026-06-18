#!/usr/bin/env node
/**
 * Convert path notation in card 0.4 (vocabulary) and glyph rules (0.1, 0.2, 0.5).
 * |L# → ←#, .r# → ⇢#; ( → ◖, ) → ◗ arc prefixes.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { toPathDigits, formatPathCount } = require('./path-digits');
const VISIBLE = { L: '←', R: '→', U: '↑', D: '↓' };
const INVISIBLE = { L: '⮜', R: '⮞', U: '⮝', D: '⮟' };

function lrudToSymbols(move, map) {
  let out = '';
  let i = 0;
  while (i < move.length) {
    const dir = move[i];
    if (!map[dir]) break;
    i++;
    let num = '';
    while (i < move.length && /\d/.test(move[i])) num += move[i++];
    out += map[dir] + formatPathCount(parseInt(num || '1', 10));
  }
  return out;
}

function convertPathString(pathStr) {
  let out = '';
  let i = 0;
  let needLineSep = false;
  let needInvSep = false;

  while (i < pathStr.length) {
    const c = pathStr[i];

    if (c === '.' || c === '|' || c === '(' || c === ')') {
      const type = c;
      i++;
      let move = '';
      while (i < pathStr.length) {
        if (/[LRUDlrud]/.test(pathStr[i])) {
          move += pathStr[i++].toUpperCase();
          while (i < pathStr.length && /\d/.test(pathStr[i])) move += pathStr[i++];
        } else break;
      }
      if (type === '.') {
        if (needInvSep) out += '⎹';
        out += lrudToSymbols(move, INVISIBLE);
        needInvSep = true;
        needLineSep = false;
      } else if (type === '|') {
        if (needLineSep) out += '⎹';
        out += lrudToSymbols(move, VISIBLE);
        needLineSep = true;
        needInvSep = false;
      } else if (type === '(') {
        out += '◖' + lrudToSymbols(move, VISIBLE);
        needLineSep = false;
        needInvSep = false;
      } else if (type === ')') {
        out += '◗' + lrudToSymbols(move, VISIBLE);
        needLineSep = false;
        needInvSep = false;
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

function convertGlyphLine(line) {
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

  const parts = body.split(/[`⌇]/);
  const converted = parts.map((seg) => {
    const comma = seg.indexOf(',');
    if (comma <= 0) return seg;
    const source = seg.slice(0, comma);
    const pathPart = seg.slice(comma + 1);
    return source + ',' + convertPathString(pathPart);
  });

  return prefix + converted.join('⌇') + suffix;
}

function buildRule14(oldRule) {
  const header =
    '// Path notation → hex. ⮞𝟮⮝𝟭 invisible — ←𝟮⎹↓𝟭 line segments — ←𝟮↑𝟭 diagonal — ◖→𝟮↑𝟭 arc h — ◗→𝟮↑𝟭 arc v';
  const seen = new Map();
  const items = [];

  for (const line of oldRule.split('\n')) {
    if (line.trim().startsWith('//')) continue;
    for (const item of line.trim().split(/\s+/)) {
      if (!item.includes(',')) continue;
      const idx = item.indexOf(',');
      const source = item.slice(0, idx);
      const target = item.slice(idx + 1);
      const neu = convertPathString(source);
      if (!seen.has(neu)) {
        seen.set(neu, target);
        items.push(`${neu},${target}`);
      }
    }
  }

  return `${header}\n${items.join(' ')}`;
}

function updateCard(filename) {
  const filePath = path.join(ROOT, filename);
  const card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!card.rule) return;
  card.rule = card.rule.split('\n').map(convertGlyphLine).join('\n');
  fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n');
}

const card04Path = path.join(ROOT, 'public/card/0.4.json');
const card04 = JSON.parse(fs.readFileSync(card04Path, 'utf8'));
card04.rule = buildRule14(card04.rule);
fs.writeFileSync(card04Path, JSON.stringify(card04, null, 2) + '\n');
console.log('Updated public/card/0.4.json');

for (const f of ['public/card/0.2.json', 'public/card/0.1.json', 'public/card/0.5.json']) {
  updateCard(f);
  console.log('Updated', f);
}
