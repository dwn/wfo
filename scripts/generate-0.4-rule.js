#!/usr/bin/env node
/**
 * Regenerate public/card/0.4.json movement + special-token rules (legacy LRUD format).
 * Run: node scripts/generate-0.4-rule.js
 */
const fs = require('fs');
const path = require('path');

function axisPartVariants(name, n, upper = false) {
  const letter = upper ? name.toUpperCase() : name;
  const variants = new Set([letter + String(n)]);
  if (n === 1) variants.add(letter);
  return [...variants];
}

function axisPartGroups(dx, dy, upper = false) {
  const groups = [];
  if (dx > 0) groups.push(axisPartVariants('r', dx, upper));
  else if (dx < 0) groups.push(axisPartVariants('l', -dx, upper));
  if (dy > 0) groups.push(axisPartVariants('d', dy, upper));
  else if (dy < 0) groups.push(axisPartVariants('u', -dy, upper));
  return groups;
}

function permuteParts(parts) {
  if (parts.length <= 1) return [parts.join('')];
  const results = new Set();
  const walk = (remaining, prefix = '') => {
    if (!remaining.length) {
      results.add(prefix);
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      walk(remaining.slice(0, i).concat(remaining.slice(i + 1)), prefix + remaining[i]);
    }
  };
  walk(parts);
  return [...results];
}

function movementVariants(dx, dy, upper = false) {
  const groups = axisPartGroups(dx, dy, upper);
  const variants = new Set();

  function pick(groupIndex, chosen) {
    if (groupIndex === groups.length) {
      for (const mov of permuteParts(chosen)) variants.add(mov);
      return;
    }
    for (const part of groups[groupIndex]) pick(groupIndex + 1, chosen.concat(part));
  }

  pick(0, []);
  return [...variants];
}

function signedToTriBits(n) {
  if (n >= 0 && n <= 4) return n;
  if (n < 0 && n >= -3) return 4 - n;
  return null;
}

const MOVE_AB_BITS = {
  line: [0, 0],
  arc_h: [1, 0],
  arc_v: [0, 1],
  invisible: [1, 1],
};

const MOVE_SPLITS = {
  'invisible,0,4': '8C',
  'invisible,0,-4': '8F8D',
  'invisible,4,0': 'C8',
  'invisible,-4,0': 'F8D8',
  'line,0,4': '0403',
  'line,0,-4': '0705',
  'line,4,0': '4040',
  'line,-4,0': '7050',
};

function hexForMovement(kind, dx, dy) {
  const xxx = signedToTriBits(dx);
  const yyy = signedToTriBits(dy);
  if (xxx === null || yyy === null) {
    return MOVE_SPLITS[`${kind},${dx},${dy}`] ?? null;
  }
  const bits = MOVE_AB_BITS[kind];
  if (!bits) return null;
  const [a, bitB] = bits;
  const b = (a << 7) | (xxx << 4) | (bitB << 3) | yyy;
  return b.toString(16).toUpperCase().padStart(2, '0');
}

const pairMap = new Map();
const kinds = [
  ['invisible', '.', false],
  ['line', '|', true],
  ['arc_h', '(', true],
  ['arc_v', ')', true],
];

for (let dx = -4; dx <= 4; dx++) {
  for (let dy = -4; dy <= 4; dy++) {
    if (dx === 0 && dy === 0) continue;
    for (const [kind, pre, upper] of kinds) {
      const hex = hexForMovement(kind, dx, dy);
      if (!hex) continue;
      for (const mov of movementVariants(dx, dy, upper)) {
        pairMap.set(`${pre}${mov}`, hex);
      }
    }
  }
}

const pairs = [...pairMap.entries()]
  .map(([source, target]) => `${source},${target}`);

pairs.sort((a, b) => b.split(',')[0].length - a.split(',')[0].length);

const rule = [
  '// Path notation → hex. .r2u1 invisible | |R2U1 line | (R2U1 arc h | )R2U1 arc v',
  pairs.join(' '),
  '∗,08 ^,00 o,80',
].join('\n');

const cardPath = path.join(__dirname, '../public/card/0.4.json');
const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
card.rule = rule;
fs.writeFileSync(cardPath, JSON.stringify(card, null, 2) + '\n');
console.log(`Updated ${cardPath} (${pairs.length} movement pairs)`);
