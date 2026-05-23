#!/usr/bin/env node
/**
 * Migrate layout delimiters in card inputs: -- → `` and layout - → `
 * Preserves literal hyphens (e.g. S-16, 2-Ea, n-.94, e+-.0005).
 */
const fs = require('fs');
const path = require('path');

function migrateInput(input) {
  if (!input || !input.includes('-')) return input;
  let s = input.replace(/--/g, '``');
  s = s.replace(/(?<=[0-9A-F]{4,})-(?=[0-9A-F]+)|(?<=[0-9A-F]+)-(?=[0-9A-F]{4,})/gi, '`');
  s = s.replace(/-(?=\n)/g, '`');
  s = s.replace(/(?<=[a-zA-Z])-(?=[a-zA-Z])/g, '`');
  return s;
}

const cardDir = path.join(__dirname, '../public/card');
let changed = 0;
for (const file of fs.readdirSync(cardDir).filter((f) => f.endsWith('.json'))) {
  const filePath = path.join(cardDir, file);
  const card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!card.input || !card.input.includes('-')) continue;
  const next = migrateInput(card.input);
  if (next !== card.input) {
    card.input = next;
    fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n');
    changed++;
    console.log(file);
  }
}
console.log(`Updated ${changed} card(s)`);
