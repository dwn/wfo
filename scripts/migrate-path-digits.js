#!/usr/bin/env node
/**
 * Normalize path move counts to sans-serif bold digits 𝟬–𝟵 after arrows.
 * Hex targets, {use_rule 1.1}, and non-path rules (e.g. 13,24) are unchanged.
 */
const fs = require('fs');
const path = require('path');
const { convertPathDigits } = require('./path-digits');

const ROOT = path.join(__dirname, '..');

function isPathVocabLine(line) {
  const parts = line.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return false;
  return parts.every((part) => {
    const comma = part.indexOf(',');
    if (comma <= 0) return false;
    return /^[∗⯭⍛⎹◖◗←→↑↓⮜⮞⮝⮟]/.test(part.slice(0, comma));
  });
}

function migratePathVocabLine(line) {
  if (line.trim().startsWith('//')) {
    return convertPathDigits(line);
  }
  return line
    .trim()
    .split(/\s+/)
    .map((item) => {
      const comma = item.indexOf(',');
      if (comma <= 0) return item;
      return convertPathDigits(item.slice(0, comma)) + item.slice(comma);
    })
    .join(' ');
}

function migrateGlyphLine(line) {
  if (line.trim().startsWith('//')) {
    return convertPathDigits(line);
  }

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
    return seg.slice(0, comma + 1) + convertPathDigits(seg.slice(comma + 1));
  });

  return prefix + converted.join('⌇') + suffix;
}

function migrateRule(rule) {
  return rule
    .split('\n')
    .map((line) => {
      if (!line.trim()) return line;
      if (isPathVocabLine(line)) return migratePathVocabLine(line);
      if (/[←→↑↓⮜⮞⮝⮟]/.test(line)) return migrateGlyphLine(line);
      return line;
    })
    .join('\n');
}

const cardDir = path.join(ROOT, 'public/card');
let changed = 0;
for (const file of fs.readdirSync(cardDir).filter((f) => f.endsWith('.json'))) {
  const filePath = path.join(cardDir, file);
  const card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!card.rule || !/[←→↑↓⮜⮞⮝⮟]/.test(card.rule)) continue;
  const next = migrateRule(card.rule);
  if (next !== card.rule) {
    card.rule = next;
    fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n');
    changed++;
    console.log(file);
  }
}
console.log(`Updated ${changed} card(s)`);
