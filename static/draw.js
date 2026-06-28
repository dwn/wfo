// ===== HEX TO GRAPHICS SYSTEM =====

// Drawing constants
const THICKNESS_MULTIPLIERS = {
  outline: 12,
  main: 4,
  pointOutline: 7.5,
  pointRadius: 4,
  endMarkerRadius: 3
};


// Helper functions
function triBitsToSigned(v3) { return (v3<=4) ? v3 : (4-v3); }
const toCanvas = (p, s=8) => ({x: p.xi*s, y: p.yi*s});
const normAngle = (a) => {
  const twoPI = Math.PI * 2;
  while (a < 0) a += twoPI;
  while (a >= twoPI) a -= twoPI;
  return a;
};
const anticlockwiseForShortest = (a0, a1) => {
  const twoPI = Math.PI * 2;
  let cw = (a1 - a0) % twoPI;
  if (cw < 0) cw += twoPI;
  let ccw = (a0 - a1) % twoPI;
  if (ccw < 0) ccw += twoPI;
  return ccw <= cw;
};
const angleOnEllipse = (cx, cy, rx, ry, x, y) => Math.atan2((y - cy) / ry, (x - cx) / rx);

function findRuleDelimiter(pair) {
  for (let i = 0; i < pair.length; i++) {
    if (pair[i] === '\\') {
      i++;
    } else if (pair[i] === ',') {
      return i;
    }
  }

  return -1;
}

function unescapeRulePart(part) {
  return part.replace(/\\([\\,])/g, '$1');
}

function normalizeDrawingSize(value, fallback = 8) {
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? size : fallback;
}

const RULE_USE_TOKEN_RE = /\{use_rule\s+(\d+)\.(\d+)\}/i;
const INPUT_USE_TOKEN_RE = /\{use_input\s+(\d+)\.(\d+)\}/i;

async function fetchCardJsonForCardRef(setNum, orderNum) {
  const filename = `${setNum}.${orderNum}.json`;
  if (typeof cardStorage !== 'undefined' && cardStorage && typeof cardStorage.readJson === 'function') {
    return cardStorage.readJson(filename);
  }
  const res = await fetch(`/card/${filename}?t=${Date.now()}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Replace each `{use_rule set.order}` token with that card's rule (recursively).
 * Tokens may appear anywhere in the Rule field. Cycles insert an empty string; missing cards too.
 */
async function expandRuleInsertions(rule, expansionPath) {
  if (rule == null) return '';
  let out = String(rule);
  const path = expansionPath || [];
  let match;
  while ((match = out.match(RULE_USE_TOKEN_RE)) !== null) {
    const full = match[0];
    const set = parseInt(match[1], 10);
    const order = parseInt(match[2], 10);
    const key = `${set}.${order}`;
    if (path.includes(key)) {
      console.warn(`Rules: reference cycle involving card ${key}; inserting empty rule.`);
      out = out.replace(full, '');
      continue;
    }
    const data = await fetchCardJsonForCardRef(set, order);
    let fragment = '';
    if (!data || typeof data.rule !== 'string') {
      console.warn(`Rules: could not load card ${key} for {use_rule …}.`);
    } else {
      path.push(key);
      try {
        fragment = await expandRuleInsertions(data.rule, path);
      } finally {
        path.pop();
      }
    }
    out = out.replace(full, fragment);
  }
  return out;
}

/**
 * Replace each `{use_input set.order}` token with that card's input (recursively).
 */
async function expandInputInsertions(input, expansionPath) {
  if (input == null) return '';
  let out = String(input);
  const path = expansionPath || [];
  let match;
  while ((match = out.match(INPUT_USE_TOKEN_RE)) !== null) {
    const full = match[0];
    const set = parseInt(match[1], 10);
    const order = parseInt(match[2], 10);
    const key = `${set}.${order}`;
    if (path.includes(key)) {
      console.warn(`Input: reference cycle involving card ${key}; inserting empty input.`);
      out = out.replace(full, '');
      continue;
    }
    const data = await fetchCardJsonForCardRef(set, order);
    let fragment = '';
    if (!data) {
      console.warn(`Input: could not load card ${key} for {use_input …}.`);
    } else {
      const next = data.input == null ? '' : String(data.input);
      path.push(key);
      try {
        fragment = await expandInputInsertions(next, path);
      } finally {
        path.pop();
      }
    }
    out = out.replace(full, fragment);
  }
  return out;
}

async function resolveReferencedRule(rule) {
  return expandRuleInsertions(rule, []);
}

async function resolveReferencedInput(input) {
  return expandInputInsertions(input, []);
}

function isPathVocabLine(line) {
  const parts = line.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return false;
  return parts.every(part => {
    const commaIndex = findRuleDelimiter(part);
    if (commaIndex <= 0) return false;
    const source = part.substring(0, commaIndex);
    return /^[∗⯭⍛⋅⎹◖◗\u2190-\u2193\u2B9C-\u2B9F]/.test(source);
  });
}

function parseRuleLinePairs(line) {
  const pairs = [];
  let items;
  if (isPathVocabLine(line)) {
    items = line.trim().split(/\s+/);
  } else if (/\s+(?=[^|\s]+,)/.test(line)) {
    items = line.split(/\s+(?=[^|\s]+,)/);
  } else {
    items = [line];
  }

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const commaIndex = findRuleDelimiter(trimmed);
    if (commaIndex > 0 && commaIndex < trimmed.length - 1) {
      pairs.push({
        source: unescapeRulePart(trimmed.substring(0, commaIndex)),
        target: unescapeRulePart(trimmed.substring(commaIndex + 1))
      });
    }
  }
  return pairs;
}

function applyRulesToText(text, lines) {
  let output = text;

  for (const line of lines) {
    const replacements = parseRuleLinePairs(line);
    if (!replacements.length) continue;

    replacements.sort((a, b) => b.source.length - a.source.length);

    let transformed = '';
    for (let i = 0; i < output.length;) {
      const replacement = replacements.find(({source}) => output.startsWith(source, i));
      if (replacement) {
        transformed += replacement.target;
        i += replacement.source.length;
      } else {
        transformed += output[i];
        i += 1;
      }
    }
    output = transformed;
  }

  return output;
}

function normalizePathSeparators(str) {
  return str.replace(/\u23B9/g, '\u22C5');
}

function applyRuleTransforms(input, rule) {
  let output = input || '';

  output = output.split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');

  if (!rule || !rule.trim()) return output;

  rule = normalizePathSeparators(rule);

  const lines = rule.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
  const rows = output.split(/\r?\n|⌇⌇/);

  return rows.map(row => applyRulesToText(normalizePathSeparators(row), lines)).join('\n');
}

// Calligraphy constants (45° nib)
const CALLIGRAPHY_NIB_ANGLE = Math.PI / 4;
const CALLIGRAPHY_MIN_FACTOR = 0.12;
const CALLIGRAPHY_SEGMENT_STEP = 1.5;

function calligraphyWidthAtAngle(tangentAngle, thickness, layer = 'main') {
  const factor = CALLIGRAPHY_MIN_FACTOR +
    (1 - CALLIGRAPHY_MIN_FACTOR) * Math.abs(Math.sin(tangentAngle - CALLIGRAPHY_NIB_ANGLE));
  const multiplier = layer === 'outline' ? THICKNESS_MULTIPLIERS.outline : THICKNESS_MULTIPLIERS.main;
  return thickness * multiplier * factor;
}

function sampleLinePath(p1, p2, step = CALLIGRAPHY_SEGMENT_STEP) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) {
    return [{ x: p1.x, y: p1.y, angle: 0 }];
  }
  const angle = Math.atan2(dy, dx);
  const steps = Math.max(1, Math.ceil(len / step));
  const samples = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    samples.push({ x: p1.x + dx * t, y: p1.y + dy * t, angle });
  }
  return samples;
}

function sampleArcPath(op, step = CALLIGRAPHY_SEGMENT_STEP, progress = 1) {
  const samples = [];
  const addSample = (t) => {
    const x = op.cx + op.rx * Math.cos(t);
    const y = op.cy + op.ry * Math.sin(t);
    const tangent = Math.atan2(op.ry * Math.cos(t), -op.rx * Math.sin(t));
    samples.push({ x, y, angle: tangent });
  };

  if (op.start === 0 && op.end === Math.PI * 2) {
    const totalAngle = Math.PI * 2 * progress;
    const steps = Math.max(8, Math.ceil(totalAngle * Math.max(op.rx, op.ry) / step));
    for (let i = 0; i <= steps; i++) {
      addSample((i / steps) * totalAngle);
    }
    return samples;
  }

  let angleDiff = op.acw ? op.start - op.end : op.end - op.start;
  if (angleDiff <= 0) angleDiff += Math.PI * 2;
  const span = angleDiff * progress;
  const steps = Math.max(1, Math.ceil(span * Math.max(op.rx, op.ry) / step));
  for (let i = 0; i <= steps; i++) {
    const t = op.acw ? op.start - (span * i / steps) : op.start + (span * i / steps);
    addSample(t);
  }
  return samples;
}

function applyItalicsToSamples(samples, s, italicsMode) {
  if (!italicsMode) return samples;
  const transformed = samples.map(p => applyItalicsTransform({ x: p.x, y: p.y }, s, italicsMode));
  return transformed.map((p, i) => {
    let angle;
    if (i < transformed.length - 1) {
      angle = Math.atan2(transformed[i + 1].y - p.y, transformed[i + 1].x - p.x);
    } else if (transformed.length > 1) {
      angle = Math.atan2(p.y - transformed[i - 1].y, p.x - transformed[i - 1].x);
    } else {
      angle = samples[i].angle;
    }
    return { x: p.x, y: p.y, angle };
  });
}

function drawCalligraphySamples(ctx, samples, thickness, color, layer = 'main') {
  if (!samples.length) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (samples.length === 1) {
    const w = calligraphyWidthAtAngle(samples[0].angle, thickness, layer);
    ctx.beginPath();
    ctx.arc(samples[0].x, samples[0].y, w * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
    return;
  }

  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.lineWidth = calligraphyWidthAtAngle(angle, thickness, layer);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCalligraphyPoint(ctx, c, thickness, color, layer = 'main') {
  const wAlong = calligraphyWidthAtAngle(CALLIGRAPHY_NIB_ANGLE, thickness, layer);
  const wPerp = calligraphyWidthAtAngle(CALLIGRAPHY_NIB_ANGLE + Math.PI / 2, thickness, layer);
  const rx = Math.max(wAlong, wPerp) * 0.5;
  const ry = Math.min(wAlong, wPerp) * 0.5;

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(CALLIGRAPHY_NIB_ANGLE);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function getCalligraphySamples(op, s, italicsMode, progress = 1) {
  if (op.type === 'line') {
    const p1 = applyItalicsTransform(toCanvas(op.from, s), s, italicsMode);
    const p2 = applyItalicsTransform(toCanvas(op.to, s), s, italicsMode);
    const fullLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (fullLen < 0.001) return sampleLinePath(p1, p2);
    const end = {
      x: p1.x + (p2.x - p1.x) * progress,
      y: p1.y + (p2.y - p1.y) * progress
    };
    return sampleLinePath(p1, end);
  }

  if (op.type === 'arc') {
    const raw = sampleArcPath(op, CALLIGRAPHY_SEGMENT_STEP, progress);
    return applyItalicsToSamples(raw, s, italicsMode);
  }

  return [];
}

// Italics transform function
function applyItalicsTransform(point, s=8, italicsMode=true) {
  if (!italicsMode) return point;
  
  const textLineHeight = 8 * s;
  const textLineIndex = Math.floor(point.y / textLineHeight);
  
  const skewFactor = -0.15;
  const yWithinTextLine = point.y - (textLineIndex * textLineHeight);
  const skewOffset = s + yWithinTextLine * skewFactor;
  
  return {
    x: point.x + skewOffset,
    y: point.y
  };
}

// Helper function to draw a correction line for arc endpoints in italics mode
function drawArcCorrectionLine(ctx, op, s, thickness, italicsMode, transformedCenter, strokeStyle, lineWidth) {
  if (!italicsMode || op.start === 0 && op.end === Math.PI * 2) return;
  
  // Where the ellipse arc actually ends (relative to transformed center)
  const endX = op.rx * Math.cos(op.end);
  const endY = op.ry * Math.sin(op.end);
  const ellipseEndPoint = {x: transformedCenter.x + endX, y: transformedCenter.y + endY};
  
  // Where the endpoint should be (using transformed center as the base)
  const originalEndX = op.rx * Math.cos(op.end);
  const originalEndY = op.ry * Math.sin(op.end);
  const originalCenter = {x: op.cx, y: op.cy};
  const intendedEndPoint = applyItalicsTransform({
    x: originalCenter.x + originalEndX,
    y: originalCenter.y + originalEndY
  }, s, italicsMode);
  
  // Draw a small line to fill the gap if they differ
  const dx = intendedEndPoint.x - ellipseEndPoint.x;
  const dy = intendedEndPoint.y - ellipseEndPoint.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  
  if (dist > 0.1) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(ellipseEndPoint.x, ellipseEndPoint.y);
    ctx.lineTo(intendedEndPoint.x, intendedEndPoint.y);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
  }
}

// Parse hex bytes from input string
function parseBytes(str) {
  const out = []; let buf = '';
  const isHex = c => /[0-9a-fA-F]/.test(c);
  for (let i = 0; i < (str ? str.length : 0); i++) {
    const ch = str[i];
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && str[i + 1] === '\n') i++;
      out.push({newline: true});
      continue;
    }
    if (ch === '⌈') {
      out.push({startAnchor: true});
      continue;
    }
    if (ch === '⌇') {
      const next = str[i + 1];
      if (next === '⌇') {
        out.push({newline: true});
        i++;
      } else {
        out.push({pipe: true});
      }
      continue;
    }
    if (isHex(ch)) {
      buf += ch;
      if (buf.length === 2) {
        out.push({byte: parseInt(buf, 16), text: buf});
        buf = '';
      }
      continue;
    } else {
      if (buf) out.push({text: buf});
      out.push({text: ch});
      buf = '';
    }
  }
  if (buf) out.push({text: buf});
  return out;
}

function textRowKey(yi, rowTopBase) {
  return rowTopBase + 8 * Math.floor((yi - rowTopBase) / 8);
}

function nextTextRowYi(yi, rowTopBase) {
  return rowTopBase + 8 * (Math.floor((yi - rowTopBase) / 8) + 1);
}

function updateHorizontalBounds(state, xi, arcMinGrid, arcMaxGrid) {
  state.minXi = Math.min(state.minXi, xi);
  state.maxXi = Math.max(state.maxXi, xi);
  if (arcMinGrid != null) state.minXi = Math.min(state.minXi, arcMinGrid);
  if (arcMaxGrid != null) state.maxXi = Math.max(state.maxXi, arcMaxGrid);
}

function processDrawItem(item, state, s, rowTopBase, snapToLineTop, textColor, mode, out) {
  if (item.startAnchor) {
    updateHorizontalBounds(state, state.xi);
    if (mode === 'build') {
      out.starts.push({ xi: state.xi, yi: state.yi, rowKey: state.rowKey });
    }
    return true;
  }
  if (item.text && item.byte === undefined) return false;

  const b = item.byte;
  const a = (b >> 7) & 1;
  const xxx = (b >> 4) & 0b111;
  const bitB = (b >> 3) & 1;
  const yyy = b & 0b111;
  const isZero = (xxx === 0 && yyy === 0);
  const ab = (a << 1) | bitB;

  if (isZero) {
    if (ab === 0b00) { state.yi = snapToLineTop(state.yi); }
    else if (ab === 0b01) {
      updateHorizontalBounds(state, state.xi);
      if (mode === 'build') {
        out.ops.push({ type: 'point', xi: state.xi, yi: state.yi, color: textColor, rowKey: state.rowKey });
      }
    } else if (ab === 0b10) {
      const cx = toCanvas({ xi: state.xi, yi: state.yi }, s).x;
      const rx = s * 0.5;
      updateHorizontalBounds(state, state.xi, Math.floor((cx - rx) / s), Math.ceil((cx + rx) / s));
      if (mode === 'build') {
        out.ops.push({
          type: 'arc',
          cx,
          cy: toCanvas({ xi: state.xi, yi: state.yi }, s).y,
          rx,
          ry: s * 0.5,
          start: 0,
          end: Math.PI * 2,
          acw: false,
          color: textColor,
          rowKey: state.rowKey,
        });
      }
    }
    if (mode === 'build') out.visited.push({ xi: state.xi, yi: state.yi });
    return true;
  }

  const dx = triBitsToSigned(xxx);
  const dy = triBitsToSigned(yyy);
  const from = { xi: state.xi, yi: state.yi };
  const to = { xi: state.xi + dx, yi: state.yi + dy };

  if (ab === 0b11) {
    state.xi = to.xi;
    state.yi = to.yi;
    updateHorizontalBounds(state, state.xi);
    if (mode === 'build') out.visited.push({ xi: state.xi, yi: state.yi });
    return true;
  }

  let arcMinGrid = null;
  let arcMaxGrid = null;
  if (ab === 0b00) {
    updateHorizontalBounds(state, from.xi, null, null);
    updateHorizontalBounds(state, to.xi, null, null);
    if (mode === 'build') {
      out.ops.push({ type: 'line', from, to, color: textColor, rowKey: state.rowKey });
    }
  } else {
    const p0 = toCanvas(from, s);
    const p1 = toCanvas(to, s);
    let cx, cy, rx, ry, a0, a1;
    if (dx !== 0 && dy !== 0) {
      rx = Math.abs(dx) * s;
      ry = Math.abs(dy) * s;
      if (ab === 0b01) { cx = p0.x; cy = p0.y + dy * s; }
      else { cx = p0.x + dx * s; cy = p0.y; }
      a0 = angleOnEllipse(cx, cy, rx, ry, p0.x, p0.y);
      a1 = angleOnEllipse(cx, cy, rx, ry, p1.x, p1.y);
      a0 = normAngle(a0);
      a1 = normAngle(a1);
      const acw = anticlockwiseForShortest(a0, a1);
      arcMinGrid = Math.floor((cx - rx) / s);
      arcMaxGrid = Math.ceil((cx + rx) / s);
      updateHorizontalBounds(state, from.xi, arcMinGrid, arcMaxGrid);
      updateHorizontalBounds(state, to.xi, arcMinGrid, arcMaxGrid);
      if (mode === 'build') {
        out.ops.push({ type: 'arc', cx, cy, rx, ry, start: a0, end: a1, acw, color: textColor, rowKey: state.rowKey });
      }
    } else if (dx !== 0 || dy !== 0) {
      let flipSemi = false;
      if (dy === 0) {
        rx = ry = Math.abs(dx) * s * 0.5;
        cx = p0.x + dx * s * 0.5;
        cy = p0.y;
        flipSemi = ab === 0b01;
      } else {
        rx = ry = Math.abs(dy) * s * 0.5;
        cy = p0.y + dy * s * 0.5;
        cx = p0.x;
        flipSemi = ab === 0b10;
      }
      a0 = angleOnEllipse(cx, cy, rx, ry, p0.x, p0.y);
      a1 = angleOnEllipse(cx, cy, rx, ry, p1.x, p1.y);
      a0 = normAngle(a0);
      a1 = normAngle(a1);
      let acw = anticlockwiseForShortest(a0, a1);
      if (flipSemi) acw = !acw;
      arcMinGrid = Math.floor((cx - rx) / s);
      arcMaxGrid = Math.ceil((cx + rx) / s);
      updateHorizontalBounds(state, from.xi, arcMinGrid, arcMaxGrid);
      updateHorizontalBounds(state, to.xi, arcMinGrid, arcMaxGrid);
      if (mode === 'build') {
        out.ops.push({ type: 'arc', cx, cy, rx, ry, start: a0, end: a1, acw, color: textColor, rowKey: state.rowKey });
      }
    }
  }

  state.xi = to.xi;
  state.yi = to.yi;
  if (mode === 'build') out.visited.push({ xi: state.xi, yi: state.yi });
  return true;
}

function measureGlyphSegment(coloredItems, startIdx, startXi, startYi, s, rowTopBase, snapToLineTop, textColor) {
  const state = {
    xi: startXi,
    yi: startYi,
    minXi: startXi,
    maxXi: startXi,
    rowKey: textRowKey(startYi, rowTopBase),
  };
  let i = startIdx;
  while (i < coloredItems.length) {
    const item = coloredItems[i];
    if (item.newline || item.pipe) break;
    processDrawItem(item, state, s, rowTopBase, snapToLineTop, textColor, 'measure', null);
    i++;
  }
  return state;
}

function isDrawableSegmentStart(coloredItems, index) {
  while (index < coloredItems.length) {
    const item = coloredItems[index];
    if (item.newline || item.pipe) return false;
    if (item.startAnchor) return true;
    if (item.text && item.byte === undefined) {
      index++;
      continue;
    }
    if (item.byte !== undefined) return true;
    index++;
  }
  return false;
}

function getArcCanvasBounds(op, s, halfStroke, italicsMode) {
  const center = applyItalicsTransform({ x: op.cx, y: op.cy }, s, italicsMode);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const includeAngle = (angle) => {
    const x = center.x + op.rx * Math.cos(angle);
    const y = center.y + op.ry * Math.sin(angle);
    minX = Math.min(minX, x - halfStroke);
    maxX = Math.max(maxX, x + halfStroke);
    minY = Math.min(minY, y - halfStroke);
    maxY = Math.max(maxY, y + halfStroke);
  };

  if (op.start === 0 && op.end === Math.PI * 2) {
    includeAngle(0);
    includeAngle(Math.PI / 2);
    includeAngle(Math.PI);
    includeAngle(Math.PI * 1.5);
    return { minX, maxX, minY, maxY };
  }

  includeAngle(op.start);
  includeAngle(op.end);
  let span = op.acw ? op.start - op.end : op.end - op.start;
  if (span <= 0) span += Math.PI * 2;
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = op.acw ? op.start - span * t : op.start + span * t;
    includeAngle(angle);
  }
  return { minX, maxX, minY, maxY };
}

function getOpVisualCanvasBounds(op, s, halfStroke, italicsMode) {
  if (op.type === 'line') {
    const p1 = applyItalicsTransform(toCanvas(op.from, s), s, italicsMode);
    const p2 = applyItalicsTransform(toCanvas(op.to, s), s, italicsMode);
    return {
      minX: Math.min(p1.x, p2.x) - halfStroke,
      maxX: Math.max(p1.x, p2.x) + halfStroke,
      minY: Math.min(p1.y, p2.y) - halfStroke,
      maxY: Math.max(p1.y, p2.y) + halfStroke,
    };
  }
  if (op.type === 'point') {
    const c = applyItalicsTransform(toCanvas(op, s), s, italicsMode);
    return {
      minX: c.x - halfStroke,
      maxX: c.x + halfStroke,
      minY: c.y - halfStroke,
      maxY: c.y + halfStroke,
    };
  }
  if (op.type === 'arc') {
    return getArcCanvasBounds(op, s, halfStroke, italicsMode);
  }
  return null;
}

function getLayoutHalfStroke(layoutOptions, s) {
  const thickness = layoutOptions.thickness ?? s / 10;
  const strokeLayer = layoutOptions.strokeLayer ?? 'outline';
  const multiplier = strokeLayer === 'main'
    ? THICKNESS_MULTIPLIERS.main
    : THICKNESS_MULTIPLIERS.outline;
  return thickness * multiplier / 2;
}

function shiftDrawOpCanvasX(op, shiftCanvas, s) {
  if (shiftCanvas === 0) return;
  if (op.type === 'line') {
    op.from.xi += shiftCanvas / s;
    op.to.xi += shiftCanvas / s;
  } else if (op.type === 'point') {
    op.xi += shiftCanvas / s;
  } else if (op.type === 'arc') {
    op.cx += shiftCanvas;
  }
}

function shiftDrawOpCanvasY(op, shiftCanvas, s) {
  if (shiftCanvas === 0) return;
  if (op.type === 'line') {
    op.from.yi += shiftCanvas / s;
    op.to.yi += shiftCanvas / s;
  } else if (op.type === 'point') {
    op.yi += shiftCanvas / s;
  } else if (op.type === 'arc') {
    op.cy += shiftCanvas;
  }
}

function shiftGridAnchorX(anchor, shiftCanvas, s) {
  if (shiftCanvas === 0) return;
  anchor.xi += shiftCanvas / s;
}

function shiftGridAnchorY(anchor, shiftCanvas, s) {
  if (shiftCanvas === 0) return;
  anchor.yi += shiftCanvas / s;
}

function applyRowCentering(ops, pipes, starts, pad, gridX, s, layoutOptions = {}) {
  const italicsMode = layoutOptions.italics !== false;
  const halfStroke = getLayoutHalfStroke(layoutOptions, s);
  const maxX = gridX - pad.right;
  const drawableCenterCanvas = (pad.left + maxX) * s / 2;
  const rowBounds = new Map();

  for (const op of ops) {
    const bounds = getOpVisualCanvasBounds(op, s, halfStroke, italicsMode);
    if (!bounds) continue;
    if (!rowBounds.has(op.rowKey)) rowBounds.set(op.rowKey, { minX: Infinity, maxX: -Infinity });
    const row = rowBounds.get(op.rowKey);
    row.minX = Math.min(row.minX, bounds.minX);
    row.maxX = Math.max(row.maxX, bounds.maxX);
  }

  const rowShifts = new Map();
  for (const [rowKey, bounds] of rowBounds) {
    const contentCenterCanvas = (bounds.minX + bounds.maxX) / 2;
    rowShifts.set(rowKey, drawableCenterCanvas - contentCenterCanvas);
  }

  for (const op of ops) {
    shiftDrawOpCanvasX(op, rowShifts.get(op.rowKey) || 0, s);
  }
  for (const anchor of pipes) {
    shiftGridAnchorX(anchor, rowShifts.get(anchor.rowKey) || 0, s);
  }
  for (const anchor of starts) {
    shiftGridAnchorX(anchor, rowShifts.get(anchor.rowKey) || 0, s);
  }
}

function applyVerticalCentering(ops, pipes, starts, pad, canvasHeight, s, layoutOptions = {}) {
  const italicsMode = layoutOptions.italics !== false;
  const halfStroke = getLayoutHalfStroke(layoutOptions, s);
  const drawableTop = pad.top * s;
  const drawableBottom = canvasHeight - pad.top * s;
  const drawableCenterCanvas = (drawableTop + drawableBottom) / 2;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const op of ops) {
    const bounds = getOpVisualCanvasBounds(op, s, halfStroke, italicsMode);
    if (!bounds) continue;
    minY = Math.min(minY, bounds.minY);
    maxY = Math.max(maxY, bounds.maxY);
  }

  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return;

  const shiftCanvas = drawableCenterCanvas - (minY + maxY) / 2;
  for (const op of ops) {
    shiftDrawOpCanvasY(op, shiftCanvas, s);
  }
  for (const anchor of pipes) {
    shiftGridAnchorY(anchor, shiftCanvas, s);
  }
  for (const anchor of starts) {
    shiftGridAnchorY(anchor, shiftCanvas, s);
  }
}

// Build drawing operations from parsed bytes  
function buildOps(coloredItems, s=8, pad={left:1, top:1, right:1}, gridX=Math.floor(600/s), backgroundColor='#808080', layoutOptions={}) {
  const centerHorizontal = layoutOptions.center === true;
  const centerVertical = layoutOptions.centerVertical === true;
  const ROW_TOP_OVERHANG = 1;
  const rowTopBase = pad.top - ROW_TOP_OVERHANG;
  const snapToLineTop = (yi) => rowTopBase + 8 * Math.floor((yi - rowTopBase) / 8);
  const maxX = gridX - pad.right;

  const rgb = hexToRgb(backgroundColor);
  const luminosity = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  const textColor = luminosity > 0.5 ? '#000000' : '#ffffff';

  let xi = pad.left;
  let yi = rowTopBase;
  let rowStartYi = yi;
  const ops = [];
  const visited = [{ xi, yi }];
  const pipes = [];
  const starts = [];
  const out = { ops, visited, pipes, starts };
  let pendingGlyphFit = isDrawableSegmentStart(coloredItems, 0);

  for (let i = 0; i < coloredItems.length; i++) {
    const item = coloredItems[i];

    if (item.newline) {
      yi = nextTextRowYi(yi, rowTopBase);
      xi = pad.left;
      rowStartYi = yi;
      visited.push({ xi, yi });
      pendingGlyphFit = isDrawableSegmentStart(coloredItems, i + 1);
      continue;
    }

    if (item.pipe) {
      pipes.push({ xi, yi, rowKey: rowStartYi });
      pendingGlyphFit = isDrawableSegmentStart(coloredItems, i + 1);
      continue;
    }

    if (pendingGlyphFit && isDrawableSegmentStart(coloredItems, i)) {
      let segment = measureGlyphSegment(coloredItems, i, xi, yi, s, rowTopBase, snapToLineTop, textColor);
      if (segment.maxXi > maxX && xi > pad.left) {
        yi = nextTextRowYi(yi, rowTopBase);
        xi = pad.left;
        rowStartYi = yi;
        segment = measureGlyphSegment(coloredItems, i, xi, yi, s, rowTopBase, snapToLineTop, textColor);
      }
      pendingGlyphFit = false;
    }

    const state = { xi, yi, minXi: xi, maxXi: xi, rowKey: rowStartYi };
    processDrawItem(item, state, s, rowTopBase, snapToLineTop, textColor, 'build', out);
    xi = state.xi;
    yi = state.yi;
  }

  if (centerHorizontal) {
    applyRowCentering(ops, pipes, starts, pad, gridX, s, layoutOptions);
  }
  if (centerVertical && layoutOptions.canvasHeight) {
    applyVerticalCentering(ops, pipes, starts, pad, layoutOptions.canvasHeight, s, layoutOptions);
  }

  return { ops, visited, pipes, starts };
}

function sameGridPoint(a, b) {
  return a.xi === b.xi && a.yi === b.yi;
}

function drawAnchorDot(ctx, center, radius, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawEditorAnchorMarkers(ctx, starts, pipes, s, italicsMode = false) {
  const r = Math.max(s * 0.22, 2.5);
  const offset = Math.max(s * 0.18, 1.8);
  const startList = starts || [];
  const pipeList = pipes || [];

  for (const anchor of startList) {
    const overlap = pipeList.some((pipe) => sameGridPoint(pipe, anchor));
    let center = applyItalicsTransform(toCanvas(anchor, s), s, italicsMode);
    if (overlap) {
      center = { x: center.x - offset, y: center.y - offset };
    }
    drawAnchorDot(ctx, center, r, '#00DDFF');
  }

  for (const anchor of pipeList) {
    const overlap = startList.some((start) => sameGridPoint(start, anchor));
    let center = applyItalicsTransform(toCanvas(anchor, s), s, italicsMode);
    if (overlap) {
      center = { x: center.x + offset, y: center.y + offset };
    }
    drawAnchorDot(ctx, center, r, '#FF00FF');
  }
}

// Drawing functions
function drawOp(ctx, op, s=8, thickness=0.8, italicsMode=false, backgroundColor='#808080', editorMode=false, calligraphyMode=false) {
  if (calligraphyMode) {
    const layer = editorMode ? 'main' : 'outline';
    const color = editorMode ? '#ffffff' : backgroundColor;

    if (op.type === 'line' || op.type === 'arc') {
      const samples = getCalligraphySamples(op, s, italicsMode);
      drawCalligraphySamples(ctx, samples, thickness, color, layer);
      return;
    }
    if (op.type === 'point') {
      const c = applyItalicsTransform(toCanvas(op, s), s, italicsMode);
      drawCalligraphyPoint(ctx, c, thickness, color, layer);
      return;
    }
  }

  if (editorMode) {
    // Editor mode: just draw white text, no outline
    const whiteColor = '#ffffff';
    
    if (op.type === 'line') {
      const p1 = applyItalicsTransform(toCanvas(op.from, s), s, italicsMode);
      const p2 = applyItalicsTransform(toCanvas(op.to, s), s, italicsMode);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = whiteColor;
      ctx.lineWidth = thickness * THICKNESS_MULTIPLIERS.main;
      ctx.stroke();
      ctx.restore();
      return;
    } else if (op.type === 'arc') {
      const transformedCenter = applyItalicsTransform({x: op.cx, y: op.cy}, s, italicsMode);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.ellipse(transformedCenter.x, transformedCenter.y, op.rx, op.ry, 0, op.start, op.end, op.acw);
      ctx.strokeStyle = whiteColor;
      ctx.lineWidth = thickness * THICKNESS_MULTIPLIERS.main;
      ctx.stroke();
      ctx.restore();
      
      drawArcCorrectionLine(ctx, op, s, thickness, italicsMode, transformedCenter, whiteColor, thickness * THICKNESS_MULTIPLIERS.main);
      return;
    } else if (op.type === 'point') {
      const c = applyItalicsTransform(toCanvas(op, s), s, italicsMode);
      ctx.beginPath();
      ctx.arc(c.x, c.y, thickness * THICKNESS_MULTIPLIERS.pointRadius, 0, Math.PI * 2);
      ctx.fillStyle = whiteColor;
      ctx.fill();
      return;
    }
  }
  
  // Card mode: draw with outline and blended colors
  // Calculate outline color (same as background)
  const outlineColor = backgroundColor;
  
  // Calculate text color (62% blend between white/black and background)
  const rgb = hexToRgb(backgroundColor);
  const luminosity = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  const baseColor = luminosity > 0.5 ? '#000000' : '#ffffff';
  const textColor = blendColors(baseColor, backgroundColor, 0.62);
  
  if (op.type === 'line') {
    const p1 = applyItalicsTransform(toCanvas(op.from, s), s, italicsMode);
    const p2 = applyItalicsTransform(toCanvas(op.to, s), s, italicsMode);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw outline (thicker, opposite color) - all lines
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = thickness * THICKNESS_MULTIPLIERS.outline;
    ctx.stroke();
    ctx.restore();
  } else if (op.type === 'arc') {
    const transformedCenter = applyItalicsTransform({x: op.cx, y: op.cy}, s, italicsMode);
    
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw outline (thicker, opposite color) - all arcs
    ctx.beginPath();
    ctx.ellipse(transformedCenter.x, transformedCenter.y, op.rx, op.ry, 0, op.start, op.end, op.acw);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = thickness * THICKNESS_MULTIPLIERS.outline;
    ctx.stroke();
    ctx.restore();
    
    drawArcCorrectionLine(ctx, op, s, thickness, italicsMode, transformedCenter, outlineColor, thickness * THICKNESS_MULTIPLIERS.outline);
  } else if (op.type === 'point') {
    const c = applyItalicsTransform(toCanvas(op, s), s, italicsMode);
    
    // Draw outline circle (thicker, same as background)
    ctx.beginPath();
    ctx.arc(c.x, c.y, thickness * THICKNESS_MULTIPLIERS.pointOutline, 0, Math.PI * 2);
    ctx.fillStyle = outlineColor;
    ctx.fill();
    
    // Draw main point (smaller, blended text color)
    ctx.beginPath();
    ctx.arc(c.x, c.y, thickness * THICKNESS_MULTIPLIERS.pointRadius, 0, Math.PI * 2);
    ctx.fillStyle = textColor;
    ctx.fill();
  }
}

// Second pass to draw the colored insides after all outlines are done
function drawOpInside(ctx, op, s=8, thickness=0.8, italicsMode=false, textColor=null, calligraphyMode=false) {
  // Use provided textColor or fall back to op.color
  const strokeColor = textColor || op.color;

  if (calligraphyMode) {
    if (op.type === 'line' || op.type === 'arc') {
      const samples = getCalligraphySamples(op, s, italicsMode);
      drawCalligraphySamples(ctx, samples, thickness, strokeColor, 'main');
    } else if (op.type === 'point') {
      const c = applyItalicsTransform(toCanvas(op, s), s, italicsMode);
      drawCalligraphyPoint(ctx, c, thickness, strokeColor, 'main');
    }
    return;
  }
  
  if (op.type === 'line') {
    const p1 = applyItalicsTransform(toCanvas(op.from, s), s, italicsMode);
    const p2 = applyItalicsTransform(toCanvas(op.to, s), s, italicsMode);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw main line (thinner, colored)
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = thickness * THICKNESS_MULTIPLIERS.main;
    ctx.stroke();
    ctx.restore();
  } else if (op.type === 'arc') {
    const transformedCenter = applyItalicsTransform({x: op.cx, y: op.cy}, s, italicsMode);
    
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw main arc (thinner, colored)
    ctx.beginPath();
    ctx.ellipse(transformedCenter.x, transformedCenter.y, op.rx, op.ry, 0, op.start, op.end, op.acw);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = thickness * THICKNESS_MULTIPLIERS.main;
    ctx.stroke();
    ctx.restore();
    
    drawArcCorrectionLine(ctx, op, s, thickness, italicsMode, transformedCenter, strokeColor, thickness * THICKNESS_MULTIPLIERS.main);
  }
}

async function drawCardPreview(canvas, cardData, isIndividualView = false) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (!cardData) return;
  const rawInput = cardData.input;
  if (rawInput == null) return;
  const rawStr = String(rawInput);
  if (rawStr.trim() === '') return;

  try {
    const resolvedInput = await resolveReferencedInput(rawStr);
    const resolvedRule = await resolveReferencedRule(cardData.rule);
    const output = applyRuleTransforms(resolvedInput, resolvedRule);
    
    // Parse hex output (not input)
    const coloredItems = parseBytes(output);
    
    // Get background color
    const { primaryColor } = getCardColors(cardData);
    
    // Get italics setting from card data
    const italicsMode = cardData.options?.italics !== false;
    const calligraphyMode = cardData.options?.calligraphy === true;
    
    // Get animation setting from card data - only animate in individual view
    const animateMode = isIndividualView && cardData.options?.animate === true;
    
    const centerMode = cardData.options?.center === true;
    const centerVerticalMode = cardData.options?.centerVertical === true;
    
    // Build drawing operations
    const s = normalizeDrawingSize(cardData.options?.size);
    const pad = { left: 3, top: 3, right: 3 };
    const gridX = Math.floor(canvas.width / s);
    const thickness = s / 10;
    const { ops, visited } = buildOps(coloredItems, s, pad, gridX, primaryColor, {
      center: centerMode,
      centerVertical: centerVerticalMode,
      canvasHeight: canvas.height,
      italics: italicsMode,
      thickness,
      strokeLayer: 'outline',
    });
    
    // Calculate text color (62% blend between white/black and background)
    const rgb = hexToRgb(primaryColor);
    const luminosity = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    const baseColor = luminosity > 0.5 ? '#000000' : '#ffffff';
    const textColor = blendColors(baseColor, primaryColor, 0.62);
    
    // Draw all operations - two passes: first outlines, then insides
    
    if (animateMode) {
      // Use animation
      animateDrawing(ctx, ops, s, pad, italicsMode, primaryColor, calligraphyMode);
    } else {
      // Static drawing - two passes: first outlines, then insides
      for (const op of ops) {
        drawOp(ctx, op, s, thickness, italicsMode, primaryColor, false, calligraphyMode);
      }
      for (const op of ops) {
        if (op.type !== 'point' || calligraphyMode) {
          drawOpInside(ctx, op, s, thickness, italicsMode, textColor, calligraphyMode);
        }
      }
    }
  } catch (error) {
    // Fallback to text if drawing fails
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Error: ${error.message}`, canvas.width / 2, canvas.height / 2);
  }
}
function animateDrawing(ctx, ops, s, pad, italicsMode=false, backgroundColor='#808080', calligraphyMode=false) {
  const STEP_DELAY_MS = 20;
  const DRAW_MS = STEP_DELAY_MS;
  const thickness = s / 10;
  
  // Calculate text color (62% blend between white/black and background)
  const rgb = hexToRgb(backgroundColor);
  const luminosity = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  const baseColor = luminosity > 0.5 ? '#000000' : '#ffffff';
  const textColor = blendColors(baseColor, backgroundColor, 0.62);
  
  let currentIndex = 0;
  const animStart = performance.now();
  const firstVisibleAt = ops.map((_, i) => animStart + i * STEP_DELAY_MS);
  
  const drawFrame = (now) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // First pass: draw all outlines
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const t0 = firstVisibleAt[i];
      const progress = Math.max(0, Math.min(1, (now - t0) / DRAW_MS));
      
      if (progress > 0) {
        drawOpAnimatedOutline(ctx, op, s, thickness, progress, italicsMode, backgroundColor, calligraphyMode);
      }
    }
    
    // Second pass: draw all insides
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const t0 = firstVisibleAt[i];
      const progress = Math.max(0, Math.min(1, (now - t0) / DRAW_MS));
      
      if (progress > 0) {
        drawOpAnimatedInside(ctx, op, s, thickness, progress, italicsMode, textColor, calligraphyMode);
      }
    }
    
    // Continue animation if not done
    const allDone = ops.length === 0 || (now >= firstVisibleAt[ops.length - 1] + DRAW_MS);
    if (!allDone) {
      requestAnimationFrame(drawFrame);
    }
  };
  
  requestAnimationFrame(drawFrame);
}

function drawOpAnimatedOutline(ctx, op, s, thickness, progress, italicsMode=false, backgroundColor='#808080', calligraphyMode=false) {
  const outlineColor = backgroundColor;

  if (calligraphyMode) {
    if (op.type === 'line' || op.type === 'arc') {
      const samples = getCalligraphySamples(op, s, italicsMode, progress);
      drawCalligraphySamples(ctx, samples, thickness, outlineColor, 'outline');
    } else if (op.type === 'point') {
      const c = applyItalicsTransform(toCanvas(op, s), s, italicsMode);
      drawCalligraphyPoint(ctx, c, thickness * progress, outlineColor, 'outline');
    }
    return;
  }

  if (op.type === 'line') {
    const p1 = applyItalicsTransform(toCanvas(op.from, s), s, italicsMode);
    const p2 = applyItalicsTransform(toCanvas(op.to, s), s, italicsMode);
    const intermediate = {
      x: p1.x + (p2.x - p1.x) * progress,
      y: p1.y + (p2.y - p1.y) * progress
    };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(intermediate.x, intermediate.y);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = thickness * THICKNESS_MULTIPLIERS.outline;
    ctx.stroke();
    ctx.restore();
  } else if (op.type === 'arc') {
    const transformedCenter = applyItalicsTransform({x: op.cx, y: op.cy}, s, italicsMode);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    let endAngle, startAngle;
    if (op.start === 0 && op.end === Math.PI * 2) {
      endAngle = progress * Math.PI * 2;
      startAngle = 0;
    } else {
      startAngle = op.start;
      let angleDiff = op.acw ? op.start - op.end : op.end - op.start;
      if (angleDiff <= 0) angleDiff += Math.PI * 2;
      const progressAngle = angleDiff * progress;
      endAngle = op.acw ? op.start - progressAngle : op.start + progressAngle;
    }
    
    ctx.beginPath();
    ctx.ellipse(transformedCenter.x, transformedCenter.y, op.rx, op.ry, 0, startAngle, endAngle, op.acw);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = thickness * THICKNESS_MULTIPLIERS.outline;
    ctx.stroke();
    ctx.restore();
    
    if (italicsMode && progress === 1) {
      drawArcCorrectionLine(ctx, op, s, thickness, italicsMode, transformedCenter, outlineColor, thickness * THICKNESS_MULTIPLIERS.outline);
    }
  } else if (op.type === 'point') {
    const c = applyItalicsTransform(toCanvas(op, s), s, italicsMode);
    ctx.beginPath();
    ctx.arc(c.x, c.y, thickness * THICKNESS_MULTIPLIERS.pointOutline * progress, 0, Math.PI * 2);
    ctx.fillStyle = outlineColor;
    ctx.fill();
  }
}

function drawOpAnimatedInside(ctx, op, s, thickness, progress, italicsMode=false, textColor, calligraphyMode=false) {
  if (calligraphyMode) {
    if (op.type === 'line' || op.type === 'arc') {
      const samples = getCalligraphySamples(op, s, italicsMode, progress);
      drawCalligraphySamples(ctx, samples, thickness, textColor, 'main');
    } else if (op.type === 'point') {
      const c = applyItalicsTransform(toCanvas(op, s), s, italicsMode);
      drawCalligraphyPoint(ctx, c, thickness * progress, textColor, 'main');
    }
    return;
  }

  if (op.type === 'line') {
    const p1 = applyItalicsTransform(toCanvas(op.from, s), s, italicsMode);
    const p2 = applyItalicsTransform(toCanvas(op.to, s), s, italicsMode);
    const intermediate = {
      x: p1.x + (p2.x - p1.x) * progress,
      y: p1.y + (p2.y - p1.y) * progress
    };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(intermediate.x, intermediate.y);
    ctx.strokeStyle = textColor;
    ctx.lineWidth = thickness * THICKNESS_MULTIPLIERS.main;
    ctx.stroke();
    ctx.restore();
  } else if (op.type === 'arc') {
    const transformedCenter = applyItalicsTransform({x: op.cx, y: op.cy}, s, italicsMode);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    let endAngle, startAngle;
    if (op.start === 0 && op.end === Math.PI * 2) {
      endAngle = progress * Math.PI * 2;
      startAngle = 0;
    } else {
      startAngle = op.start;
      let angleDiff = op.acw ? op.start - op.end : op.end - op.start;
      if (angleDiff <= 0) angleDiff += Math.PI * 2;
      const progressAngle = angleDiff * progress;
      endAngle = op.acw ? op.start - progressAngle : op.start + progressAngle;
    }
    
    ctx.beginPath();
    ctx.ellipse(transformedCenter.x, transformedCenter.y, op.rx, op.ry, 0, startAngle, endAngle, op.acw);
    ctx.strokeStyle = textColor;
    ctx.lineWidth = thickness * THICKNESS_MULTIPLIERS.main;
    ctx.stroke();
    ctx.restore();
    
    if (italicsMode && progress === 1) {
      drawArcCorrectionLine(ctx, op, s, thickness, italicsMode, transformedCenter, textColor, thickness * THICKNESS_MULTIPLIERS.main);
    }
  } else if (op.type === 'point') {
    const c = applyItalicsTransform(toCanvas(op, s), s, italicsMode);
    ctx.beginPath();
    ctx.arc(c.x, c.y, thickness * THICKNESS_MULTIPLIERS.pointRadius * progress, 0, Math.PI * 2);
    ctx.fillStyle = textColor;
    ctx.fill();
  }
}
function drawGridPoints(ctx, spacing, width, height, thickness, italicsMode=false) {
  ctx.save();
  const baseColor = '#666666';
  const r = thickness * 3;
  
  for (let y = 0; y <= height; y += spacing) {
    const textRowIndex = Math.floor(y / (8 * spacing));
    const isEvenTextRow = textRowIndex % 2 === 0;
    
    const rowColor = isEvenTextRow ? '#6e6e6e' : '#565656';
    
    ctx.fillStyle = rowColor;
    ctx.globalAlpha = 1;
    
    for (let x = 0; x <= width; x += spacing) {
      const point = applyItalicsTransform({x, y}, spacing, italicsMode);
      ctx.beginPath();
      ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
