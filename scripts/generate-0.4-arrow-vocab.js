#!/usr/bin/env node
/**
 * Regenerate public/card/0.4.json path→hex vocabulary for counts 1–9.
 * Moves beyond 4 grid units decompose into multiple bytes.
 * Run: node scripts/generate-0.4-arrow-vocab.js
 */
const fs = require('fs');
const path = require('path');
const { toPathDigits, formatPathCount, withExplicitUnitCounts } = require('./path-digits');

const MAX_COUNT = 9;

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

function hexForStep(kind, dx, dy) {
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

function nextStep(kind, remX, remY) {
  const limitX = remX === 0 ? 0 : Math.min(Math.abs(remX), 4);
  const limitY = remY === 0 ? 0 : Math.min(Math.abs(remY), 4);
  for (let ax = limitX; ax >= 0; ax--) {
    for (let ay = limitY; ay >= 0; ay--) {
      if (ax === 0 && ay === 0) continue;
      const stepX = remX === 0 ? 0 : Math.sign(remX) * ax;
      const stepY = remY === 0 ? 0 : Math.sign(remY) * ay;
      if (stepX === 0 && stepY === 0) continue;
      if (hexForStep(kind, stepX, stepY)) return [stepX, stepY];
    }
  }
  return null;
}

function decomposeMovement(kind, dx, dy) {
  const steps = [];
  let remX = dx;
  let remY = dy;
  while (remX !== 0 || remY !== 0) {
    const step = nextStep(kind, remX, remY);
    if (!step) {
      throw new Error(`Cannot decompose ${kind} (${dx}, ${dy}) at remainder (${remX}, ${remY})`);
    }
    steps.push(step);
    remX -= step[0];
    remY -= step[1];
  }
  return steps;
}

function hexForMovement(kind, dx, dy) {
  if (dx === 0 && dy === 0) return '';
  const steps = decomposeMovement(kind, dx, dy);
  let hex = '';
  for (const [stepX, stepY] of steps) {
    const stepHex = hexForStep(kind, stepX, stepY);
    if (!stepHex) {
      throw new Error(`No hex for ${kind} (${stepX}, ${stepY}) in (${dx}, ${dy})`);
    }
    hex += stepHex;
  }
  return hex;
}

function movementParts(dx, dy, invisible) {
  const parts = [];
  if (dx < 0) parts.push({ arrow: invisible ? '⮜' : '←', count: -dx });
  else if (dx > 0) parts.push({ arrow: invisible ? '⮞' : '→', count: dx });
  if (dy < 0) parts.push({ arrow: invisible ? '⮝' : '↑', count: -dy });
  else if (dy > 0) parts.push({ arrow: invisible ? '⮟' : '↓', count: dy });
  return parts;
}

function permuteParts(parts) {
  if (parts.length <= 1) return [parts];
  const results = [];
  const walk = (remaining, chosen) => {
    if (!remaining.length) {
      results.push(chosen);
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      walk(remaining.slice(0, i).concat(remaining.slice(i + 1)), chosen.concat(remaining[i]));
    }
  };
  walk(parts, []);
  return results;
}

function arrowVariants(dx, dy, invisible) {
  const parts = movementParts(dx, dy, invisible);
  const variants = new Set();
  for (const order of permuteParts(parts)) {
    variants.add(order.map((p) => p.arrow + formatPathCount(p.count)).join(''));
  }
  return [...variants];
}

const pairMap = new Map();
const kinds = [
  ['invisible', '', true],
  ['line', '', false],
  ['arc_h', '◖', false],
  ['arc_v', '◗', false],
];

for (let dx = -MAX_COUNT; dx <= MAX_COUNT; dx++) {
  for (let dy = -MAX_COUNT; dy <= MAX_COUNT; dy++) {
    if (dx === 0 && dy === 0) continue;
    for (const [kind, prefix, invisible] of kinds) {
      const hex = hexForMovement(kind, dx, dy);
      if (!hex) continue;
      for (const mov of arrowVariants(dx, dy, invisible)) {
        const key = `${prefix}${mov}`;
        pairMap.set(key, hex);
        const explicit = withExplicitUnitCounts(key);
        if (explicit !== key) pairMap.set(explicit, hex);
      }
    }
  }
}

const pairs = [...pairMap.entries()]
  .map(([source, target]) => `${source},${target}`)
  .sort((a, b) => b.split(',')[0].length - a.split(',')[0].length);

const header =
  '// Path notation → hex. Count 1: arrow only (→ ≡ →𝟭). ⮞⮝ invisible — ←⎹↓ line — ←↑ diagonal — ←𝟵↑𝟵 long — ◖→↑ arc h — ◗→↑ arc v';
const rule = `${header}\n${pairs.join(' ')} ∗,08 ⯭,00 ⍛,80`;

const cardPath = path.join(__dirname, '../public/card/0.4.json');
const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
card.rule = rule;
fs.writeFileSync(cardPath, JSON.stringify(card, null, 2) + '\n');
console.log(`Updated ${cardPath} (${pairs.length} movement pairs, counts 1–${MAX_COUNT})`);
