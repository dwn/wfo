#!/usr/bin/env node
/**
 * Omit explicit 1-step path counts (→𝟭 → →). Skips 0.4.json — regenerate that instead.
 */
const fs = require('fs');
const path = require('path');
const { stripUnitPathCounts } = require('./path-digits');

const CARD_DIR = path.join(__dirname, '../public/card');
const SKIP = new Set(['0.4.json']);

function stripLine(line) {
  if (!/[←→↑↓⮜⮞⮝⮟]/.test(line)) return line;
  if (line.trim().startsWith('//')) return stripUnitPathCounts(line);

  const parts = line.trim().split(/\s+/);
  if (parts.every((p) => {
    const comma = p.indexOf(',');
    return comma > 0 && /^[∗⯭⍛⋅◖◗←→↑↓⮜⮞⮝⮟]/.test(p.slice(0, comma));
  })) {
    return parts
      .map((item) => {
        const comma = item.indexOf(',');
        if (comma <= 0) return item;
        return stripUnitPathCounts(item.slice(0, comma)) + item.slice(comma);
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
    return seg.slice(0, comma + 1) + stripUnitPathCounts(seg.slice(comma + 1));
  });

  return prefix + converted.join('⌇') + suffix;
}

function migrateRule(rule) {
  return rule.split('\n').map(stripLine).join('\n');
}

function main() {
  let changed = 0;
  for (const file of fs.readdirSync(CARD_DIR).filter((f) => f.endsWith('.json') && !SKIP.has(f))) {
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
