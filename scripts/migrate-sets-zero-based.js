#!/usr/bin/env node
/**
 * One-time migration: renumber sets 1-based → 0-based (old set N → new set N-1).
 * Also decrements {use_rule S.order} set indices in rule text.
 *
 * Run from repo root: node scripts/migrate-sets-zero-based.js
 */
const fs = require('fs');
const path = require('path');

const CARD_DIR = path.join(__dirname, '../public/card');
const CARD_NAME_RE = /^(\d+)\.(\d+)\.json$/;
const USE_RULE_RE = /\{use_rule\s+(\d+)\.(\d+)\}/g;

function listCardFiles() {
  return fs.readdirSync(CARD_DIR).filter((name) => CARD_NAME_RE.test(name));
}

function maxSetNumber(filenames) {
  let max = -1;
  for (const name of filenames) {
    const m = name.match(CARD_NAME_RE);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

function decrementUseRules(rule, maxSet) {
  if (!rule || typeof rule !== 'string') return rule;
  let out = rule;
  for (let s = maxSet; s >= 1; s--) {
    const from = `{use_rule ${s}.`;
    const to = `{use_rule ${s - 1}.`;
    out = out.split(from).join(to);
  }
  return out;
}

function main() {
  const files = listCardFiles();
  if (files.length === 0) {
    console.log('No card files found.');
    return;
  }

  const maxSet = maxSetNumber(files);
  if (maxSet < 1) {
    console.log('Sets already appear 0-based (max set < 1). Skipping rename.');
    return;
  }

  // Phase 1: move to temp names to avoid collisions.
  const tempMap = new Map();
  for (const name of files) {
    const m = name.match(CARD_NAME_RE);
    const setNum = parseInt(m[1], 10);
    const order = m[2];
    const tempName = `__migrate.${setNum}.${order}.json`;
    fs.renameSync(path.join(CARD_DIR, name), path.join(CARD_DIR, tempName));
    tempMap.set(tempName, setNum);
  }

  // Phase 2: write to new set numbers with updated use_rule refs.
  for (const [tempName, oldSet] of tempMap) {
    const m = tempName.match(/^__migrate\.(\d+)\.(\d+)\.json$/);
    const order = m[2];
    const newSet = oldSet - 1;
    const destName = `${newSet}.${order}.json`;
    const filePath = path.join(CARD_DIR, tempName);
    const card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (card.rule) {
      card.rule = decrementUseRules(card.rule, maxSet);
    }
    fs.writeFileSync(
      path.join(CARD_DIR, destName),
      JSON.stringify(card, null, 2) + '\n',
      'utf8',
    );
    fs.unlinkSync(filePath);
    console.log(`${oldSet}.${order}.json → ${destName}`);
  }

  console.log(`Migrated ${tempMap.size} cards (sets 1..${maxSet} → 0..${maxSet - 1}).`);
}

main();
