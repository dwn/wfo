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

function applyRuleTransforms(input, rule) {
  let output = input || '';

  output = output.split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');

  if (!rule || !rule.trim()) return output;

  const lines = rule.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));

  for (const line of lines) {
    const replacements = [];
    const pairs = line.trim().split(/\s+/);

    for (const pair of pairs) {
      const commaIndex = findRuleDelimiter(pair);
      if (commaIndex > 0 && commaIndex < pair.length - 1) {
        replacements.push({
          source: unescapeRulePart(pair.substring(0, commaIndex)),
          target: unescapeRulePart(pair.substring(commaIndex + 1))
        });
      }
    }

    if (!replacements.length) continue;

    // Longest source first so e.g. ((d4)) wins over (d4), (cl1d1) over (cl1).
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
    if (ch === '|') {
      const next = str[i + 1];
      if (next === '|') {
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

// Build drawing operations from parsed bytes  
function buildOps(coloredItems, s=8, pad={left:1, top:1, right:1}, gridX=Math.floor(600/s), backgroundColor='#808080') {
  let xi = pad.left, yi = pad.top;
  const ops = []; const visited = [{xi, yi}];
  
  const preMoveWrap = (xi, yi, dx) => {
    const maxX = gridX - pad.right;
    if (dx > 0 && (xi + dx) > maxX) { xi = pad.left; yi += 8; }
    return { xi, yi };
  };
  const snapToLineTop = (yi) => pad.top + 8 * Math.floor((yi - pad.top) / 8);
  
  for (const item of coloredItems) {
    if (item.newline) {
      yi = pad.top + 8 * (Math.floor((yi - pad.top) / 8) + 1);
      xi = pad.left;
      visited.push({xi, yi});
      continue;
    }
    if (item.pipe) {
      continue;
    }
    if (item.text && item.byte === undefined) continue;
    
    const b = item.byte;
    const rgb = hexToRgb(backgroundColor);
    const luminosity = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    const textColor = luminosity > 0.5 ? '#000000' : '#ffffff';
    
    const a = (b >> 7) & 1;
    const xxx = (b >> 4) & 0b111;
    const bitB = (b >> 3) & 1;
    const yyy = b & 0b111;
    const isZero = (xxx === 0 && yyy === 0);
    const ab = (a << 1) | bitB;
    const isInvisibleMove = ab === 0b11;
    
    if (isZero) {
      if (ab === 0b00) { yi = snapToLineTop(yi); }
      else if (ab === 0b01) { ops.push({type: 'point', xi, yi, color: textColor}); }
      else if (ab === 0b10) { ops.push({type: 'arc', cx: toCanvas({xi, yi}, s).x, cy: toCanvas({xi, yi}, s).y, rx: s*0.5, ry: s*0.5, start: 0, end: Math.PI*2, acw: false, color: textColor}); }
      visited.push({xi, yi});
      continue;
    }
    
    const dx = triBitsToSigned(xxx), dy = triBitsToSigned(yyy);
    ({xi, yi} = preMoveWrap(xi, yi, Math.max(0, dx)));
    const from = {xi, yi};
    const to = {xi: xi + dx, yi: yi + dy};
    
    if (ab === 0b11) {
      xi = to.xi; yi = to.yi;
      visited.push({xi, yi});
      continue;
    }
    
    if (ab === 0b00) {
      ops.push({type: 'line', from, to, color: textColor});
    } else {
      const p0 = toCanvas(from, s), p1 = toCanvas(to, s);
      let cx, cy, rx, ry, a0, a1;
      if (dx !== 0 && dy !== 0) {
        rx = Math.abs(dx)*s; ry = Math.abs(dy)*s;
        if (ab === 0b01) { cx = p0.x; cy = p0.y + dy*s; }
        else { cx = p0.x + dx*s; cy = p0.y; }
      } else if (dx !== 0 || dy !== 0) {
        if (dy === 0) {
          rx = ry = Math.abs(dx)*s*0.5;
          cx = p0.x + dx*s*0.5;
          cy = ab === 0b10 ? p0.y : p0.y + Math.sign(dx)*rx;
        } else {
          rx = ry = Math.abs(dy)*s*0.5;
          cy = p0.y + dy*s*0.5;
          cx = ab === 0b01 ? p0.x : p0.x + Math.sign(dy)*rx;
        }
      }
      if (rx) {
        a0 = angleOnEllipse(cx, cy, rx, ry, p0.x, p0.y);
        a1 = angleOnEllipse(cx, cy, rx, ry, p1.x, p1.y);
        a0 = normAngle(a0); a1 = normAngle(a1);
        const acw = anticlockwiseForShortest(a0, a1);
        ops.push({type: 'arc', cx, cy, rx, ry, start: a0, end: a1, acw, color: textColor});
      }
    }
    
    xi = to.xi; yi = to.yi;
    visited.push({xi, yi});
  }
  
  return { ops, visited };
}

// Drawing functions
function drawOp(ctx, op, s=8, thickness=0.8, italicsMode=false, backgroundColor='#808080', editorMode=false) {
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
function drawOpInside(ctx, op, s=8, thickness=0.8, italicsMode=false, textColor=null) {
  // Use provided textColor or fall back to op.color
  const strokeColor = textColor || op.color;
  
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
    
    // Get animation setting from card data - only animate in individual view
    const animateMode = isIndividualView && cardData.options?.animate === true;
    
    // Build drawing operations
    const s = normalizeDrawingSize(cardData.options?.size);
    const pad = { left: 3, top: 3, right: 3 };
    const gridX = Math.floor(canvas.width / s);
    const { ops, visited } = buildOps(coloredItems, s, pad, gridX, primaryColor);
    
    // Calculate text color (62% blend between white/black and background)
    const rgb = hexToRgb(primaryColor);
    const luminosity = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    const baseColor = luminosity > 0.5 ? '#000000' : '#ffffff';
    const textColor = blendColors(baseColor, primaryColor, 0.62);
    
    // Draw all operations - two passes: first outlines, then insides
    const thickness = s / 10;
    
    if (animateMode) {
      // Use animation
      animateDrawing(ctx, ops, s, pad, italicsMode, primaryColor);
    } else {
      // Static drawing - two passes: first outlines, then insides
      for (const op of ops) {
        drawOp(ctx, op, s, thickness, italicsMode, primaryColor);
      }
      for (const op of ops) {
        if (op.type !== 'point') {
          drawOpInside(ctx, op, s, thickness, italicsMode, textColor);
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
function animateDrawing(ctx, ops, s, pad, italicsMode=false, backgroundColor='#808080') {
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
        drawOpAnimatedOutline(ctx, op, s, thickness, progress, italicsMode, backgroundColor);
      }
    }
    
    // Second pass: draw all insides
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const t0 = firstVisibleAt[i];
      const progress = Math.max(0, Math.min(1, (now - t0) / DRAW_MS));
      
      if (progress > 0) {
        drawOpAnimatedInside(ctx, op, s, thickness, progress, italicsMode, textColor);
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

function drawOpAnimatedOutline(ctx, op, s, thickness, progress, italicsMode=false, backgroundColor='#808080') {
  const outlineColor = backgroundColor;
  
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

function drawOpAnimatedInside(ctx, op, s, thickness, progress, italicsMode=false, textColor) {
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
