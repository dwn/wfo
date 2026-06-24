#!/usr/bin/env node
/**
 * One-time: remap path digits so visible glyph matches grid-step count.
 * Old encoding stored count N at U+1D7ED+N (display showed N+1). New encoding uses U+1D7ED+(N-1).
 */
const fs = require('fs');
const path = require('path');
const { PATH_DIR, remapLegacyPathDigits } = require('./path-digits');

const CARD_DIR = path.join(__dirname, '../public/card');

function remapLine(line) {
  if (!/[←→↑↓⮜⮞⮝⮟]/.test(line)) return line;
  if (line.trim().startsWith('//')) return remapLegacyPathDigits(line);

  const parts = line.trim().split(/\s+/);
  if (parts.every((p) => {
    const comma = p.indexOf(',');
    return comma > 0 && /^[∗⯭⍛⋅◖◗←→↑↓⮜⮞⮝⮟]/.test(p.slice(0, comma));
  })) {
    return parts
      .map((item) => {
        const comma = item.indexOf(',');
        if (comma <= 0) return item;
        return remapLegacyPathDigits(item.slice(0, comma)) + item.slice(comma);
      })
      .join(' ');
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

  const converted = body.split('⌇').map((seg) => {
    const comma = seg.indexOf(',');
    if (comma <= 0) return seg;
    return seg.slice(0, comma + 1) + remapLegacyPathDigits(seg.slice(comma + 1));
  });

  return prefix + converted.join('⌇') + suffix;
}

function migrateRule(rule) {
  return rule.split('\n').map(remapLine).join('\n');
}

function main() {
  let changed = 0;
  for (const file of fs.readdirSync(CARD_DIR).filter((f) => f.endsWith('.json'))) {
    const filePath = path.join(CARD_DIR, file);
    const card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!card.rule || !/[←→↑↓⮜⮞⮝⮟]/.test(card.rule)) continue;
    const next = migrateRule(card.rule);
    if (next !== card.rule) {
      card.rule = next;
      fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf8');
      console.log('Updated', file);
      changed++;
    }
  }
  console.log(`Done. ${changed} card(s) updated.`);
}

main();
