#!/usr/bin/env node
/** Replace legacy ⎹ stroke separator with ⋅ in card rules. */
const fs = require('fs');
const path = require('path');
const { normalizePathSeparators } = require('./path-digits');

const CARD_DIR = path.join(__dirname, '../public/card');
let changed = 0;

for (const file of fs.readdirSync(CARD_DIR).filter((f) => f.endsWith('.json'))) {
  const filePath = path.join(CARD_DIR, file);
  const card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!card.rule || !card.rule.includes('⎹')) continue;
  const next = normalizePathSeparators(card.rule);
  if (next !== card.rule) {
    card.rule = next;
    fs.writeFileSync(filePath, JSON.stringify(card, null, 2) + '\n', 'utf8');
    console.log('Updated', file);
    changed++;
  }
}

console.log(`Done. ${changed} card(s) updated.`);
