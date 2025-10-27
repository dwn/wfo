const SUPABASE_URL = '{{SUPABASE_URL}}';
const SUPABASE_SERVICE_ROLE_KEY = '{{SUPABASE_SERVICE_ROLE_KEY}}';
const CARD_BASE_URL = `${SUPABASE_URL}/storage/v1/object/public/card/`;
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
let cardData = new Map();
let setInfo = new Map();
let currentSetNumber = 1;
let availableSets = [];
function formatCardFilename(set, order) {
  return `${set}.${order}.json`;
}
function parseCardFilename(filename) {
  const match = filename.match(/^(\d+)\.(\d+)\.json$/);
  if (match) {
    return {
      set: parseInt(match[1], 10),
      order: parseInt(match[2], 10)
    };
  }
  return null;
}
function generateGradientFromColor(hexColor, secondColor = null) {
  if (hexColor === 'transparent') {
    return 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)';
  }
  
  if (secondColor && secondColor !== '' && secondColor !== 'transparent') {
    // Horizontal gradient from first color to second color
    return `linear-gradient(90deg, ${hexColor} 0%, ${secondColor} 100%)`;
  }
  
  // Original diagonal gradient with lighter/darker variations
  const rgb = hexToRgb(hexColor);
  const lighter = `rgb(${Math.min(255, rgb.r + 40)}, ${Math.min(255, rgb.g + 40)}, ${Math.min(255, rgb.b + 40)})`;
  const darker = `rgb(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)})`;
  return `linear-gradient(135deg, ${lighter} 0%, ${hexColor} 50%, ${darker} 100%)`;
}
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 128, g: 128, b: 128 };
}
function blendColors(color1, color2, ratio) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  // ratio is how much of color1 to use, (1-ratio) is how much of color2
  const r = Math.round(rgb1.r * ratio + rgb2.r * (1 - ratio));
  const g = Math.round(rgb1.g * ratio + rgb2.g * (1 - ratio));
  const b = Math.round(rgb1.b * ratio + rgb2.b * (1 - ratio));
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}
function getCardColor(cardData) {
  if (cardData && cardData.options && cardData.options.backgroundColor) {
    return cardData.options.backgroundColor;
  }
  return '#808080';
}
function getCardColors(cardData) {
  const primaryColor = getCardColor(cardData);
  const secondColor = cardData?.options?.backgroundColor2 || null;
  return { primaryColor, secondColor };
}
function stripSvgColors(svgContent, keepNaturalColors = false) {
  if (keepNaturalColors) {
    return svgContent;
  }
  let processed = svgContent;
  processed = processed.replace(/fill="[^"]*"/g, 'fill="currentColor"');
  processed = processed.replace(/fill='[^']*'/g, "fill='currentColor'");
  processed = processed.replace(/stroke="[^"]*"/g, 'stroke="currentColor"');
  processed = processed.replace(/stroke='[^']*'/g, "stroke='currentColor'");
  processed = processed.replace(/\s*stroke-width="[^"]*"/g, '');
  processed = processed.replace(/\s*stroke-width='[^']*'/g, '');
  processed = processed.replace(/\s*style="[^"]*fill:[^;"]*[^"]*"/g, '');
  processed = processed.replace(/\s*style='[^']*fill:[^;']*[^']*'/g, '');
  processed = processed.replace(/\s*style="[^"]*stroke:[^;"]*[^"]*"/g, '');
  processed = processed.replace(/\s*style='[^']*stroke:[^;']*[^']*'/g, '');
  return processed;
}
function createSvgStyle(hasTransform = false, transformValue = '1', textColor = 'currentColor', useNaturalColors = false) {
  if (useNaturalColors) {
    return `svg {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      object-position: center;
      ${hasTransform ? `transform: scale(${transformValue});` : ''}
      opacity: 0.5;
    }`;
  } else {
    return `svg {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      object-position: center;
      ${hasTransform ? `transform: scale(${transformValue});` : ''}
      opacity: 0.5;
      color: ${textColor};
    }
    .svg-container svg * {
      fill: currentColor;
      stroke: currentColor;
      stroke-width: 0;
    }`;
  }
}
function calculateSvgTextColor(backgroundColor, editorVisible) {
  if (backgroundColor === 'transparent') {
    return editorVisible ? '#000000' : '#ffffff';
  }
  const rgb = hexToRgb(backgroundColor);
  const luminosity = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminosity > 0.5 ? '#000000' : '#ffffff';
}
async function loadCardData(set, order) {
  try {
    const filename = formatCardFilename(set, order);
    const cacheBuster = `?t=${Date.now()}`;
    const response = await fetch(`${CARD_BASE_URL}${filename}${cacheBuster}`);
    if (!response.ok) {
      return null;
    }
    const cardData = await response.json();
    return cardData;
  } catch (error) {
    console.error(`Failed to load card ${set}.${order}:`, error);
    return null;
  }
}
const COLORS = [
  { name: 'red', hex: '#FF0000' },
  { name: 'orange', hex: '#FF7B00' },
  { name: 'yellow', hex: '#FFF200' },
  { name: 'green', hex: '#36FF00' },
  { name: 'sky', hex: '#008EFF' },
  { name: 'blue', hex: '#1100FF' },
  { name: 'violet', hex: '#79008D' },
  { name: 'gray', hex: '#808080' },
  { name: 'white', hex: '#FFFFFF' }
];

// ===== HEX TO GRAPHICS SYSTEM =====

// Drawing constants
const THICKNESS_MULTIPLIERS = {
  outline: 12,
  main: 4,
  pointOutline: 7.5,
  pointRadius: 4,
  endMarkerRadius: 3
};

// Derive hex pair colors from the COLORS array (excluding black, gray, white for better visibility)
const HEX_PAIR_COLORS = COLORS
  .filter(c => c.hex !== '#000000' && c.hex !== '#808080' && c.hex !== '#ffffff')
  .map(c => c.hex);

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
const esc = (s) => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

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
function buildOps(coloredItems, s=8, pad={left:1, top:1, right:1}, gridX=Math.floor(600/s), backgroundColor='#808080', letterIndex=0, noColorization=false) {
  let xi = pad.left, yi = pad.top;
  const ops = []; const visited = [{xi, yi}];
  let currentLetterHexPairIndex = 0;
  
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
      letterIndex++;
      currentLetterHexPairIndex = 0;
      continue;
    }
    if (item.text && item.byte === undefined) continue;
    
    const b = item.byte;
    const isCurrentLetter = letterIndex === 0;
    const rgb = hexToRgb(backgroundColor);
    const luminosity = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    let textColor = luminosity > 0.5 ? '#000000' : '#ffffff';
    
    let stroke;
    if (noColorization) {
      stroke = textColor;
    } else if (isCurrentLetter) {
      const colorIndex = currentLetterHexPairIndex % HEX_PAIR_COLORS.length;
      stroke = HEX_PAIR_COLORS[colorIndex];
      currentLetterHexPairIndex++;
    } else {
      stroke = textColor;
    }
    
    const a = (b >> 7) & 1;
    const xxx = (b >> 4) & 0b111;
    const bitB = (b >> 3) & 1;
    const yyy = b & 0b111;
    const isZero = (xxx === 0 && yyy === 0);
    const ab = (a << 1) | bitB;
    const isInvisibleMove = ab === 0b11;
    
    if (!noColorization && isCurrentLetter && !isInvisibleMove) {
      const colorIndex = currentLetterHexPairIndex % HEX_PAIR_COLORS.length;
      stroke = HEX_PAIR_COLORS[colorIndex];
      currentLetterHexPairIndex++;
    }
    
    if (isZero) {
      if (ab === 0b00) { yi = snapToLineTop(yi); }
      else if (ab === 0b01) { ops.push({type: 'point', xi, yi, color: stroke}); }
      else if (ab === 0b10) { ops.push({type: 'arc', cx: toCanvas({xi, yi}, s).x, cy: toCanvas({xi, yi}, s).y, rx: s*0.5, ry: s*0.5, start: 0, end: Math.PI*2, acw: false, color: stroke}); }
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
      ops.push({type: 'line', from, to, color: stroke});
    } else {
      const p0 = toCanvas(from, s), p1 = toCanvas(to, s);
      let cx, cy, rx, ry, a0, a1;
      if (dx !== 0 && dy !== 0) {
        rx = Math.abs(dx)*s; ry = Math.abs(dy)*s;
        if (ab === 0b01) { cx = p0.x; cy = p0.y + dy*s; }
        else { cx = p0.x + dx*s; cy = p0.y; }
        a0 = angleOnEllipse(cx, cy, rx, ry, p0.x, p0.y);
        a1 = angleOnEllipse(cx, cy, rx, ry, p1.x, p1.y);
        a0 = normAngle(a0); a1 = normAngle(a1);
        const acw = anticlockwiseForShortest(a0, a1);
        ops.push({type: 'arc', cx, cy, rx, ry, start: a0, end: a1, acw, color: stroke});
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

function drawCardPreview(canvas, cardData, isIndividualView = false) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (!cardData || !cardData.input) return;
  
  try {
    // Process input through rules to get output
    let output = cardData.input;
    
    // Filter out comment lines
    output = output.split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n');
    
    // Apply replacement rules if they exist
    if (cardData.rule && cardData.rule.trim()) {
      const lines = cardData.rule.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
      
      for (const line of lines) {
        const pairs = line.trim().split(/\s+/);
        
        for (const pair of pairs) {
          const commaIndex = pair.indexOf(',');
          if (commaIndex > 0 && commaIndex < pair.length - 1) {
            const source = pair.substring(0, commaIndex);
            const target = pair.substring(commaIndex + 1);
            
            output = output.replace(new RegExp(escapeRegExp(source), 'g'), target);
          }
        }
      }
    }
    
    // Parse hex output (not input)
    const coloredItems = parseBytes(output);
    
    // Get background color
    const { primaryColor } = getCardColors(cardData);
    
    // Get italics setting from card data
    const italicsMode = cardData.options?.italics !== false;
    
    // Get animation setting from card data - only animate in individual view
    const animateMode = isIndividualView && cardData.options?.animate === true;
    
    // Build drawing operations
    const s = 8;
    const pad = { left: 2, top: 2, right: 2 };
    const gridX = Math.floor(canvas.width / s);
    const { ops, visited } = buildOps(coloredItems, s, pad, gridX, primaryColor, 0, true);
    
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
let draggedCard = null;
let dragOffGridTimer = null;
let isDraggingOffGrid = false;
let lastDragX = 0;
let cardToDelete = null;
let cardToCopy = null;
let isProcessingDrop = false;
function setupDragAndDrop(setNumber) {
  const gridEl = document.getElementById('gridContainer');
  gridEl.removeEventListener('dragstart', handleDragStart);
  gridEl.removeEventListener('dragend', handleDragEnd);
  gridEl.removeEventListener('dragover', handleDragOver);
  gridEl.removeEventListener('drop', handleDrop);
  function handleDragStart(e) {
    if (e.target.classList.contains('card-wrapper') && e.target.hasAttribute('data-order')) {
      draggedCard = e.target;
      e.target.classList.add('dragging');
      e.target.classList.add('drag-source');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
      const trashCan = document.getElementById('trashCan');
      const copyButton = document.getElementById('copyButton');
      if (trashCan) {
        trashCan.classList.add('show');
      }
      if (copyButton) {
        copyButton.classList.add('show');
      }
      document.addEventListener('dragover', checkDragOffGrid);
    }
  }
  function checkDragOffGrid(e) {
    if (!draggedCard) return;
    lastDragX = e.clientX;
    const gridEl = document.getElementById('gridContainer');
    const trashCan = document.getElementById('trashCan');
    const copyButton = document.getElementById('copyButton');
    if (!gridEl || !trashCan || !copyButton) return;
    const gridRect = gridEl.getBoundingClientRect();
    const trashRect = trashCan.getBoundingClientRect();
    const copyRect = copyButton.getBoundingClientRect();
    const isOverTrash = (
      e.clientX >= trashRect.left &&
      e.clientX <= trashRect.right &&
      e.clientY >= trashRect.top &&
      e.clientY <= trashRect.bottom
    );
    const isOverCopy = (
      e.clientX >= copyRect.left &&
      e.clientX <= copyRect.right &&
      e.clientY >= copyRect.top &&
      e.clientY <= copyRect.bottom
    );
    if (isOverCopy) {
    }
    const isOutsideGrid = (
      (e.clientX < gridRect.left || e.clientX > gridRect.right || 
       e.clientY < gridRect.top || e.clientY > gridRect.bottom) &&
      !isOverTrash && !isOverCopy
    );
    const prevArea = document.getElementById('prevSetArea');
    const nextArea = document.getElementById('nextSetArea');
    if (isOverTrash) {
      trashCan.classList.add('drag-over');
      copyButton.classList.remove('drag-over');
      if (dragOffGridTimer) {
        clearTimeout(dragOffGridTimer);
        dragOffGridTimer = null;
      }
      prevArea.style.background = '';
      nextArea.style.background = '';
      isDraggingOffGrid = false;
    } else if (isOverCopy) {
      copyButton.classList.add('drag-over');
      trashCan.classList.remove('drag-over');
      if (dragOffGridTimer) {
        clearTimeout(dragOffGridTimer);
        dragOffGridTimer = null;
      }
      prevArea.style.background = '';
      nextArea.style.background = '';
      isDraggingOffGrid = false;
    } else {
      trashCan.classList.remove('drag-over');
      copyButton.classList.remove('drag-over');
      if (isOutsideGrid && !isDraggingOffGrid) {
        isDraggingOffGrid = true;
        const direction = e.clientX < gridRect.left ? 'prev' : 'next';
        const currentIndex = availableSets.indexOf(currentSetNumber);
        const canGoPrev = currentIndex > 0;
        const canGoNext = currentIndex < availableSets.length - 1;
        if (direction === 'prev' && canGoPrev) {
          prevArea.style.background = 'rgba(255, 255, 255, 0.05)';
        } else if (direction === 'next' && canGoNext) {
          nextArea.style.background = 'rgba(255, 255, 255, 0.05)';
        } else if (direction === 'next' && !canGoNext) {
          nextArea.style.background = 'rgba(255, 255, 255, 0.05)';
        } else {
        }
        if ((direction === 'prev' && canGoPrev) || (direction === 'next' && (canGoNext || !canGoNext))) {
          dragOffGridTimer = setTimeout(() => {
            const targetSet = findNonFullSet(direction);
            if (targetSet !== null) {
              const draggedOrder = parseInt(draggedCard.getAttribute('data-order'));
              moveCardToSet(currentSetNumber, draggedOrder, targetSet);
            } else {
              let newSetNumber;
              if (availableSets.length === 0) {
                newSetNumber = direction === 'next' ? 2 : 1;
              } else {
                newSetNumber = direction === 'next' ? Math.max(...availableSets) + 1 : Math.min(...availableSets) - 1;
              }
              if (newSetNumber > 0) {
                const draggedOrder = parseInt(draggedCard.getAttribute('data-order'));
                moveCardToSet(currentSetNumber, draggedOrder, newSetNumber);
              } else {
              }
            }
            prevArea.style.background = '';
            nextArea.style.background = '';
          }, 1000);
        }
      } else if (!isOutsideGrid && isDraggingOffGrid) {
        clearTimeout(dragOffGridTimer);
        isDraggingOffGrid = false;
        prevArea.style.background = '';
        nextArea.style.background = '';
      }
    }
  }
  function handleDragEnd(e) {
    document.removeEventListener('dragover', checkDragOffGrid);
    if (dragOffGridTimer) {
      clearTimeout(dragOffGridTimer);
      dragOffGridTimer = null;
    }
    isDraggingOffGrid = false;
    const prevArea = document.getElementById('prevSetArea');
    const nextArea = document.getElementById('nextSetArea');
    const trashCan = document.getElementById('trashCan');
    const copyButton = document.getElementById('copyButton');
    if (prevArea) prevArea.style.background = '';
    if (nextArea) nextArea.style.background = '';
    if (e.target.classList.contains('card-wrapper')) {
      e.target.classList.remove('dragging');
      e.target.classList.remove('drag-source');
      const allCards = gridEl.querySelectorAll('.card-wrapper');
      allCards.forEach(card => card.classList.remove('drag-over'));
      const trashRect = trashCan.getBoundingClientRect();
      const copyRect = copyButton.getBoundingClientRect();
      const isOverTrash = (
        e.clientX >= trashRect.left &&
        e.clientX <= trashRect.right &&
        e.clientY >= trashRect.top &&
        e.clientY <= trashRect.bottom
      );
      const isOverCopy = (
        e.clientX >= copyRect.left &&
        e.clientX <= copyRect.right &&
        e.clientY >= copyRect.top &&
        e.clientY <= copyRect.bottom
      );
      if (isOverTrash && draggedCard) {
        const draggedOrder = parseInt(draggedCard.getAttribute('data-order'));
        cardToDelete = {
          set: currentSetNumber,
          order: draggedOrder,
          element: draggedCard
        };
        showDeleteModal();
      } else if (isOverCopy && draggedCard) {
        const draggedOrder = parseInt(draggedCard.getAttribute('data-order'));
        cardToCopy = {
          set: currentSetNumber,
          order: draggedOrder,
          element: draggedCard
        };
        copyCard();
      } else {
      }
      if (trashCan) {
        trashCan.classList.remove('drag-over');
        trashCan.classList.remove('show');
      }
      if (copyButton) {
        copyButton.classList.remove('drag-over');
        copyButton.classList.remove('show');
      }
      setTimeout(() => {
        draggedCard = null;
      }, 100);
    }
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const allCards = gridEl.querySelectorAll('.card-wrapper');
    allCards.forEach(card => card.classList.remove('drag-over'));
    let closestCard = null;
    let closestDistance = Infinity;
    for (const card of allCards) {
      if (card === draggedCard || card.classList.contains('empty-slot')) continue;
      const cardRect = card.getBoundingClientRect();
      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;
      const distance = Math.sqrt(
        Math.pow(e.clientX - cardCenterX, 2) + 
        Math.pow(e.clientY - cardCenterY, 2)
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestCard = card;
      }
    }
    if (closestCard) {
      closestCard.classList.add('drag-over');
    }
  }
  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedCard || isProcessingDrop) return;
    isProcessingDrop = true;
    
    try {
    let targetCard = null;
    let closestDistance = Infinity;
    const allCards = gridEl.querySelectorAll('.card-wrapper');
    for (const card of allCards) {
      if (card === draggedCard) continue;
      const cardRect = card.getBoundingClientRect();
      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;
      const distance = Math.sqrt(
        Math.pow(e.clientX - cardCenterX, 2) + 
        Math.pow(e.clientY - cardCenterY, 2)
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        targetCard = card;
      }
    }
    const targetRow = parseInt(targetCard?.style.gridRow) || 1;
    const targetCol = parseInt(targetCard?.style.gridColumn) || 1;
    const originalDraggedRow = parseInt(draggedCard.style.gridRow) || 1;
    const originalDraggedCol = parseInt(draggedCard.style.gridColumn) || 1;
    if (targetRow === originalDraggedRow && targetCol === originalDraggedCol) {
      targetCard?.classList.remove('drag-over');
      isProcessingDrop = false;
      return;
    }
    const currentSet = currentSetNumber;
    const draggedOrder = parseInt(draggedCard.getAttribute('data-order'));
    const isTargetEmpty = !targetCard || targetCard.classList.contains('empty-slot');
    const targetOrder = targetCard ? parseInt(targetCard.getAttribute('data-order')) : null;
    if (targetCard && targetCard.classList.contains('empty-slot')) {
      const allRealCards = gridEl.querySelectorAll('.card-wrapper:not(.empty-slot)');
      for (const realCard of allRealCards) {
        const realCardRow = parseInt(realCard.style.gridRow) || 1;
        const realCardCol = parseInt(realCard.style.gridColumn) || 1;
        if (realCardRow === targetRow && realCardCol === targetCol) {
          targetCard = realCard;
          break;
        }
      }
    }
    const finalIsTargetEmpty = !targetCard || targetCard.classList.contains('empty-slot');
    if (finalIsTargetEmpty) {
      draggedCard.style.gridRow = targetRow;
      draggedCard.style.gridColumn = targetCol;
      const originalEmptySlot = document.createElement('div');
      originalEmptySlot.className = 'card-wrapper empty-slot';
      originalEmptySlot.style.gridRow = originalDraggedRow;
      originalEmptySlot.style.gridColumn = originalDraggedCol;
      gridEl.appendChild(originalEmptySlot);
      await updateCardPosition(currentSet, draggedOrder, targetRow, targetCol);
    } else {
      const targetOrder = parseInt(targetCard.getAttribute('data-order'));
      draggedCard.style.gridRow = targetRow;
      draggedCard.style.gridColumn = targetCol;
      targetCard.style.gridRow = originalDraggedRow;
      targetCard.style.gridColumn = originalDraggedCol;
      await Promise.all([
        updateCardPosition(currentSet, draggedOrder, targetRow, targetCol),
        updateCardPosition(currentSet, targetOrder, originalDraggedRow, originalDraggedCol)
      ]);
    }
    targetCard.classList.remove('drag-over');
    } catch (error) {
      console.error('Error in handleDrop:', error);
    } finally {
      isProcessingDrop = false;
  }
  }
  gridEl.addEventListener('dragstart', handleDragStart);
  gridEl.addEventListener('dragend', handleDragEnd);
  gridEl.addEventListener('dragover', handleDragOver);
  gridEl.addEventListener('drop', handleDrop);
}
async function updateCardPosition(set, order, row, col) {
  try {
    const key = `${set}.${order}`;
    let cardDataObj = cardData.get(key);
    if (!cardDataObj) {
      cardDataObj = await loadCardData(set, order);
      if (!cardDataObj) {
        return;
      }
      cardData.set(key, cardDataObj);
    }
    if (!cardDataObj.options) {
      cardDataObj.options = {};
    }
    cardDataObj.options.position = { row, col };
    cardData.set(key, cardDataObj);
    const jsonString = JSON.stringify(cardDataObj, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const fileName = formatCardFilename(set, order);
    const { error } = await supabaseClient.storage
      .from('card')
      .upload(fileName, blob, {
        contentType: 'application/json',
        upsert: true
      });
    if (error) {
      console.error(`Failed to save position for ${set}.${order}:`, error);
    }
  } catch (error) {
    console.error(`Error updating position for ${set}.${order}:`, error);
  }
}
async function showIndividualCard(setNumber, order, cardData) {
  const individualView = document.getElementById('individualCardView');
  const individualCard = document.getElementById('individualCard');
  const gridContainer = document.getElementById('gridContainer');
  if (gridContainer) {
    gridContainer.remove();
  }
  individualCard.innerHTML = '';
  
  // Set the background gradient on the card container
  const { primaryColor, secondColor } = getCardColors(cardData);
  individualCard.style.background = generateGradientFromColor(primaryColor, secondColor);
  
  // Create transparent canvas for drawing text
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 848;
  individualCard.appendChild(canvas);
  
  drawCardPreview(canvas, cardData, true);  // true = individual view
  if (cardData.options && cardData.options.svgBackground) {
    const svgValue = cardData.options.svgBackground;
    let svgContent = null;
    if (svgValue.startsWith('http://') || svgValue.startsWith('https://')) {
      try {
        const response = await fetch(svgValue);
        svgContent = await response.text();
      } catch (error) {
        console.error('Failed to load SVG:', error);
      }
    } else {
      svgContent = svgValue;
    }
    if (svgContent) {
      const { primaryColor } = getCardColors(cardData);
      const textColor = calculateSvgTextColor(primaryColor, false);
      const useNaturalColors = cardData.options && cardData.options.svgColor === true;
      const cleanedSvg = stripSvgColors(svgContent, useNaturalColors);
      const svgContainer = document.createElement('div');
      svgContainer.className = 'svg-container';
      const uniqueId = `svg-${setNumber}-${order}`;
      svgContainer.id = uniqueId;
      svgContainer.innerHTML = `
        <style>
          #${uniqueId} svg {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: contain;
            object-position: center;
            opacity: 0.5;
            ${useNaturalColors ? '' : `color: ${textColor};`}
          }
          ${useNaturalColors ? '' : `#${uniqueId} svg * {
            fill: currentColor;
            stroke: currentColor;
            stroke-width: 0;
          }`}
        </style>
        ${cleanedSvg}
      `;
      individualCard.appendChild(svgContainer);
      svgContainer.offsetHeight;
    }
  }
  individualView.style.display = 'flex';
}
function hideIndividualCard() {
  const individualView = document.getElementById('individualCardView');
  const gridContainer = document.getElementById('gridContainer');
  individualView.style.display = 'none';
  if (gridContainer) {
    gridContainer.style.display = 'grid';
  } else {
    displaySet(currentSetNumber);
  }
}
async function scanAllSets() {
  try {
    const { data: files, error } = await supabaseClient.storage
      .from('card')
      .list('', { limit: 1000 });
    if (error) throw error;
    const sets = new Map();
    let maxSetFound = 0;
    for (const file of files) {
      const parsed = parseCardFilename(file.name);
      if (parsed) {
        if (!sets.has(parsed.set)) {
          sets.set(parsed.set, []);
        }
        sets.get(parsed.set).push(parsed);
        maxSetFound = Math.max(maxSetFound, parsed.set);
      } else {
      }
    }
    availableSets = [];
    for (let setNum = 1; setNum <= maxSetFound; setNum++) {
      const cards = sets.get(setNum) || [];
      const sortedCards = cards.sort((a, b) => a.order - b.order);
      setInfo.set(setNum, {
        cardCount: cards.length,
        cards: sortedCards
      });
      availableSets.push(setNum);
    }
  } catch (error) {
    console.error('Error scanning sets:', error);
  }
}
async function loadCardDataCached(set, order) {
  const key = `${set}.${order}`;
  if (cardData.has(key)) {
    return cardData.get(key);
  }
  const data = await loadCardData(set, order);
  cardData.set(key, data);
  return data;
}
async function fixCardPositions(setNumber, cardsToFix) {
  try {
    for (const cardFix of cardsToFix) {
      const { order, data, newPosition } = cardFix;
      if (!data.options) data.options = {};
      data.options.position = newPosition;
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const fileName = formatCardFilename(setNumber, order);
      const { error } = await supabaseClient.storage
        .from('card')
        .upload(fileName, blob, {
          contentType: 'application/json',
          upsert: true
        });
      if (error) {
        console.error(`Failed to fix position for card ${setNumber}.${order}:`, error);
      } else {
        const key = `${setNumber}.${order}`;
        cardData.set(key, data);
      }
    }
    await scanAllSets();
  } catch (error) {
    console.error('Error fixing card positions:', error);
  }
}
async function displaySet(setNumber) {
  const statusEl = document.getElementById('status');
  let gridEl = document.getElementById('gridContainer');
  if (!gridEl) {
    gridEl = document.createElement('div');
    gridEl.id = 'gridContainer';
    gridEl.className = 'grid-container';
    gridEl.style.display = 'none';
    document.body.insertBefore(gridEl, document.getElementById('individualCardView'));
  }
  statusEl.style.display = 'block';
  gridEl.style.display = 'none';
  gridEl.innerHTML = '';
  try {
    let loadedCards;
    if (setInfo.has(setNumber)) {
      const setCards = setInfo.get(setNumber).cards;
      const cardPromises = setCards.map(card => 
        loadCardDataCached(setNumber, card.order).then(data => ({ order: card.order, data }))
      );
      loadedCards = await Promise.all(cardPromises);
    } else {
      const cardPromises = [];
      for (let order = 1; order <= 15; order++) {
        cardPromises.push(loadCardDataCached(setNumber, order).then(data => ({ order, data })));
      }
      loadedCards = await Promise.all(cardPromises);
    }
    const gridPositions = new Map();
    const cardsWithoutPosition = [];
    const cardsToFix = [];
    loadedCards.forEach(({ order, data }) => {
      if (data && data.options && data.options.position) {
        const { row, col } = data.options.position;
        if (row !== null && col !== null && typeof row === 'number' && typeof col === 'number') {
          const key = `${row}-${col}`;
          if (gridPositions.has(key)) {
            cardsWithoutPosition.push({ order, data });
          } else {
            gridPositions.set(key, { order, data });
          }
        } else {
          cardsWithoutPosition.push({ order, data });
        }
      } else if (data) {
        cardsWithoutPosition.push({ order, data });
      } else {
      }
    });
    let cardWithoutPosIndex = 0;
    for (let row = 1; row <= 5; row++) {
      for (let col = 1; col <= 3; col++) {
        const key = `${row}-${col}`;
        if (!gridPositions.has(key) && cardWithoutPosIndex < cardsWithoutPosition.length) {
          const cardToPlace = cardsWithoutPosition[cardWithoutPosIndex];
          gridPositions.set(key, cardToPlace);
          cardsToFix.push({
            order: cardToPlace.order,
            data: cardToPlace.data,
            newPosition: { row, col }
          });
          cardWithoutPosIndex++;
        }
      }
    }
    for (let row = 1; row <= 5; row++) {
      for (let col = 1; col <= 3; col++) {
        const key = `${row}-${col}`;
        const cardInfo = gridPositions.get(key);
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'card-wrapper';
        cardWrapper.style.gridRow = row;
        cardWrapper.style.gridColumn = col;
      if (cardInfo) {
        const { order, data: cardData } = cardInfo;
        cardWrapper.setAttribute('draggable', 'true');
        cardWrapper.setAttribute('data-order', order);
      if (cardData) {
        const orderLabel = document.createElement('div');
        orderLabel.className = 'card-order';
        orderLabel.textContent = order;
        cardWrapper.appendChild(orderLabel);
        cardWrapper.addEventListener('click', () => {
          showIndividualCard(setNumber, order, cardData);
        });
        const editButton = document.createElement('button');
        editButton.className = 'card-edit-button';
        editButton.innerHTML = '✏️';
        editButton.title = 'Edit Card';
        editButton.addEventListener('click', (e) => {
          e.stopPropagation();
          openCardEditor(setNumber, order, cardData);
        });
        cardWrapper.appendChild(editButton);
        const svgContainer = document.createElement('div');
        svgContainer.className = 'svg-container';
        cardWrapper.appendChild(svgContainer);
        if (cardData.options && cardData.options.svgBackground) {
          const svgValue = cardData.options.svgBackground;
          let svgContent = null;
          if (svgValue.startsWith('http://') || svgValue.startsWith('https://')) {
            try {
              const response = await fetch(svgValue);
              svgContent = await response.text();
            } catch (error) {
              console.error('Failed to load SVG:', error);
            }
          } else {
            svgContent = svgValue;
          }
          if (svgContent) {
            const { primaryColor } = getCardColors(cardData);
            const textColor = calculateSvgTextColor(primaryColor, false);
            const useNaturalColors = cardData.options && cardData.options.svgColor === true;
            const cleanedSvg = stripSvgColors(svgContent, useNaturalColors);
            const uniqueId = `svg-${setNumber}-${order}`;
            svgContainer.id = uniqueId;
            svgContainer.innerHTML = `
              <style>
                #${uniqueId} svg {
                  width: 100%;
                  height: 100%;
                  display: block;
                  object-fit: contain;
                  object-position: center;
                  opacity: 0.5;
                  ${useNaturalColors ? '' : `color: ${textColor};`}
                }
                ${useNaturalColors ? '' : `#${uniqueId} svg * {
                  fill: currentColor;
                  stroke: currentColor;
                  stroke-width: 0;
                }`}
              </style>
              ${cleanedSvg}
            `;
            svgContainer.offsetHeight;
          }
        }
        const { primaryColor, secondColor } = getCardColors(cardData);
        cardWrapper.style.background = generateGradientFromColor(primaryColor, secondColor);
        
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 848;
        cardWrapper.appendChild(canvas);
        drawCardPreview(canvas, cardData);
      }
      } else {
        cardWrapper.classList.add('empty-slot');
        const placeholder = document.createElement('div');
        placeholder.style.width = '100%';
        placeholder.style.height = '100%';
        placeholder.style.pointerEvents = 'none';
        cardWrapper.appendChild(placeholder);
      }
      gridEl.appendChild(cardWrapper);
      }
    }
    statusEl.style.display = 'none';
    gridEl.style.display = 'grid';
    if (cardsToFix.length > 0) {
      fixCardPositions(setNumber, cardsToFix);
    }
    setupDragAndDrop(setNumber);
    updateNavigationAreas();
  } catch (error) {
    statusEl.style.display = 'none';
    console.error('Error displaying set:', error);
  }
}
let currentEditingCard = null;
function toggleAccordion(header) {
  const accordion = header.parentElement;
  accordion.classList.toggle('collapsed');
}
function openCardEditor(setNumber, order, cardData) {
  currentEditingCard = { setNumber, order, cardData };
  document.getElementById('editorOrder').value = order || '';
  document.getElementById('editorSize').value = cardData.options?.size || 5;
  document.getElementById('editorSizeValue').textContent = cardData.options?.size || 5;
  document.getElementById('editorBackground').value = cardData.options?.backgroundColor || 'transparent';
  document.getElementById('editorBackground2').value = cardData.options?.backgroundColor2 || '';
  document.getElementById('editorItalics').checked = cardData.options?.italics !== false;
  document.getElementById('animatePreview').checked = cardData.options?.animate === true;
  document.getElementById('editorSvgColor').checked = cardData.options?.svgColor === true;
  document.getElementById('editorSvg').value = cardData.options?.svgBackground || '';
  
  // Handle contenteditable divs
  const ruleEl = document.getElementById('editorRule');
  const inputEl = document.getElementById('editorInput');
  ruleEl.value = cardData.rule || '';
  inputEl.textContent = cardData.input || '';
  
  // Trigger highlighting after a brief delay to ensure the content is set
  setTimeout(() => {
    highlightEditor(inputEl);
    updateEditorOutput();
    updateEditorPreview();
  }, 50);
  const positionDisplay = document.getElementById('editorPositionDisplay');
  if (cardData.options?.position) {
    positionDisplay.textContent = `Row ${cardData.options.position.row}, Col ${cardData.options.position.col}`;
  } else {
    positionDisplay.textContent = 'Not set';
  }
  document.getElementById('cardEditorModal').style.display = 'flex';
}
function closeCardEditor() {
  document.getElementById('cardEditorModal').style.display = 'none';
  currentEditingCard = null;
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

function highlightEditor(element) {
  if (!element) return;
  
  // Get plain text content
  const raw = element.textContent || element.innerText || '';
  
  if (!raw) {
    element.innerHTML = '';
    return;
  }
  
  // Get current cursor position to determine which "letter" we're on
  const selection = window.getSelection();
  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  let cursorPos = 0;
  if (range) {
    const preRange = document.createRange();
    preRange.selectNodeContents(element);
    preRange.setEnd(range.endContainer, range.endOffset);
    cursorPos = preRange.toString().length;
  }
  
  // Calculate which letter index we're in (based on | separators)
  const hasPipes = raw.includes('|');
  let currentLetterIndex = 0;
  let currentPos = 0;
  
  if (hasPipes) {
    for (let i = 0; i < raw.length && i < cursorPos; i++) {
      if (raw[i] === '|') {
        if (i + 1 < raw.length && raw[i + 1] === '|') {
          currentLetterIndex++;
          i++;
        } else {
          currentLetterIndex++;
        }
      }
      currentPos++;
    }
  }
  
  // Escape HTML special characters
  const escText = esc(raw);
  
  // Basic hex highlighting - colorize hex pairs
  const HEX_CHAR_RE = /[0-9A-Fa-f]/;
  let html = '';
  let i = 0;
  let letterIndex = 0;
  let hexPairIndex = 0;
  let inComment = false;
  
  while (i < escText.length) {
    const ch = escText[i];
    
    // Check for comment start
    if (ch === '/' && i + 1 < escText.length && escText[i + 1] === '/') {
      inComment = true;
      html += ch;
      i++;
      continue;
    }
    
    // If in comment, just output characters until end of line
    if (inComment) {
      html += ch;
      i++;
      // Check for newline (comment end)
      if (ch === '\n' || ch === '\r') {
        inComment = false;
      }
      continue;
    }
    
    if (ch === '|') {
      const next = escText[i + 1];
      if (next === '|') {
        html += '||';
        i += 2;
        if (hasPipes) {
          letterIndex++;
          hexPairIndex = 0;
        }
      } else {
        html += '|';
        i++;
        if (hasPipes) {
          letterIndex++;
          hexPairIndex = 0;
        }
      }
    } else if (HEX_CHAR_RE.test(ch) && i + 1 < escText.length && HEX_CHAR_RE.test(escText[i + 1])) {
      // Found a hex pair
      const pair = escText.substr(i, 2);
      const byte = parseInt(pair, 16);
      const a = (byte >> 7) & 1;
      const xxx = (byte >> 4) & 0b111;
      const bitB = (byte >> 3) & 1;
      const yyy = byte & 0b111;
      const isZero = (xxx === 0 && yyy === 0);
      const ab = (a << 1) | bitB;
      const isInvisibleMove = ab === 0b11;
      
      const isCurrentLetter = (letterIndex === currentLetterIndex);
      const isMoveOnly = ab === 0b00 && isZero;
      
      if (isCurrentLetter && !isInvisibleMove && !isMoveOnly) {
        // Color each hex pair in current letter with different colors
        const colorIndex = hexPairIndex % HEX_PAIR_COLORS.length;
        const hexColor = HEX_PAIR_COLORS[colorIndex];
        html += `<strong style="color: ${hexColor};">${pair}</strong>`;
      } else if (isInvisibleMove || isMoveOnly) {
        // Invisible moves and move-only commands get yellow highlight background
        html += `<span style="background: #ffff00; color: #000;">${pair}</span>`;
      } else {
        html += pair;
      }
      
      // Always increment hexPairIndex when in current letter
      if (isCurrentLetter) {
        hexPairIndex++;
      }
      
      i += 2;
    } else {
      html += ch;
      i++;
    }
  }
  
  element.innerHTML = html;
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

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateEditorOutput() {
  const ruleEl = document.getElementById('editorRule');
  const inputEl = document.getElementById('editorInput');
  const outputEl = document.getElementById('editorOutput');
  
  const rule = ruleEl ? ruleEl.value : '';
  const input = inputEl ? (inputEl.textContent || inputEl.innerText || '') : '';
  
  let output = input;
  
  output = output.split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n');
  
  if (rule && rule.trim()) {
    const lines = rule.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
    
    for (const line of lines) {
      const pairs = line.trim().split(/\s+/);
      
      for (const pair of pairs) {
        const commaIndex = pair.indexOf(',');
        if (commaIndex > 0 && commaIndex < pair.length - 1) {
          const source = pair.substring(0, commaIndex);
          const target = pair.substring(commaIndex + 1);
          
          output = output.replace(new RegExp(escapeRegExp(source), 'g'), target);
        }
      }
    }
  }
  
  if (outputEl && inputEl && output) {
    // Apply highlighting based on cursor position in input field
    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    let cursorPos = 0;
    
    if (range && inputEl.contains(range.startContainer)) {
      const preRange = document.createRange();
      preRange.selectNodeContents(inputEl);
      preRange.setEnd(range.endContainer, range.endOffset);
      cursorPos = preRange.toString().length;
    }
    
    const hasPipes = input.includes('|');
    let currentLetterIndex = 0;
    
    if (hasPipes) {
      for (let i = 0; i < input.length && i < cursorPos; i++) {
        if (input[i] === '|') {
          if (i + 1 < input.length && input[i + 1] === '|') {
            currentLetterIndex++;
            i++;
          } else {
            currentLetterIndex++;
          }
        }
      }
    }
    
    const escText = esc(output);
    const HEX_CHAR_RE = /[0-9A-Fa-f]/;
    let html = '';
    let i = 0;
    let letterIndex = 0;
    let hexPairIndex = 0;
    let inComment = false;
    
    while (i < escText.length) {
      const ch = escText[i];
      
      if (ch === '/' && i + 1 < escText.length && escText[i + 1] === '/') {
        inComment = true;
        html += ch;
        i++;
        continue;
      }
      
      if (inComment) {
        html += ch;
        i++;
        if (ch === '\n' || ch === '\r') {
          inComment = false;
        }
        continue;
      }
      
      if (ch === '|') {
        const next = escText[i + 1];
        if (next === '|') {
          html += '||';
          i += 2;
          if (hasPipes) {
            letterIndex++;
            hexPairIndex = 0;
          }
        } else {
          html += '|';
          i++;
          if (hasPipes) {
            letterIndex++;
            hexPairIndex = 0;
          }
        }
      } else if (HEX_CHAR_RE.test(ch) && i + 1 < escText.length && HEX_CHAR_RE.test(escText[i + 1])) {
        const pair = escText.substr(i, 2);
        const byte = parseInt(pair, 16);
        const a = (byte >> 7) & 1;
        const xxx = (byte >> 4) & 0b111;
        const bitB = (byte >> 3) & 1;
        const yyy = byte & 0b111;
        const isZero = (xxx === 0 && yyy === 0);
        const ab = (a << 1) | bitB;
        const isInvisibleMove = ab === 0b11;
        
        const isCurrentLetter = (letterIndex === currentLetterIndex);
        const isMoveOnly = ab === 0b00 && isZero;
        
        if (isCurrentLetter && !isInvisibleMove && !isMoveOnly) {
          html += `<strong>${pair}</strong>`;
        } else if (isInvisibleMove || isMoveOnly) {
          html += `<span style="background: #ffff00; color: #000;">${pair}</span>`;
        } else {
          html += pair;
        }
        
        if (isCurrentLetter) {
          hexPairIndex++;
        }
        
        i += 2;
      } else {
        html += ch;
        i++;
      }
    }
    
    outputEl.innerHTML = html;
  } else {
    if (outputEl) {
      outputEl.textContent = output;
    }
  }
}

function updateEditorPreview() {
  const canvas = document.getElementById('editorCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  canvas.style.background = '#000000';
  
  const bgColor = document.getElementById('editorBackground').value;
  const bgColor2 = document.getElementById('editorBackground2').value;
  
  const outputEl = document.getElementById('editorOutput');
  const output = outputEl ? (outputEl.textContent || outputEl.value || '') : '';
  
  if (!output) {
  ctx.fillStyle = '#666';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Card Preview', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  try {
    const coloredItems = parseBytes(output);
    const s = 8;
    const pad = { left: 2, top: 2, right: 2 };
    const gridX = Math.floor(canvas.width / s);
    const { ops, visited } = buildOps(coloredItems, s, pad, gridX, bgColor, 0);
    
    const thickness = s / 10;
    
    const italicsCheckbox = document.getElementById('editorItalics');
    const italicsMode = italicsCheckbox ? italicsCheckbox.checked : false;
    
    // Always draw static preview in editor mode
    drawGridPoints(ctx, s, canvas.width, canvas.height, thickness, italicsMode);
    // Editor mode: draw white text only, no outline
    for (const op of ops) {
      drawOp(ctx, op, s, thickness, italicsMode, bgColor, true);
    }
  } catch (error) {
    ctx.fillStyle = '#ff0000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Error: ${error.message}`, canvas.width / 2, canvas.height / 2);
  }
}
async function saveCard() {
  if (!currentEditingCard) return;
  try {
    const { setNumber, order } = currentEditingCard;
    const newOrder = document.getElementById('editorOrder').value;
    const size = parseInt(document.getElementById('editorSize').value);
    const backgroundColor = document.getElementById('editorBackground').value;
    const backgroundColor2 = document.getElementById('editorBackground2').value;
    const italics = document.getElementById('editorItalics').checked;
    const animate = document.getElementById('animatePreview').checked;
    const svgColor = document.getElementById('editorSvgColor').checked;
    const svgBackground = document.getElementById('editorSvg').value;
    const ruleEl = document.getElementById('editorRule');
    const inputEl = document.getElementById('editorInput');
    const rule = ruleEl ? ruleEl.value : '';
    const input = inputEl ? (inputEl.textContent || inputEl.value || '') : '';
    const cardDataObj = currentEditingCard.cardData;
    cardDataObj.rule = rule;
    cardDataObj.input = input;
    if (!cardDataObj.options) cardDataObj.options = {};
    cardDataObj.options.size = size;
    cardDataObj.options.backgroundColor = backgroundColor;
    if (backgroundColor2) {
      cardDataObj.options.backgroundColor2 = backgroundColor2;
    } else {
      delete cardDataObj.options.backgroundColor2;
    }
    cardDataObj.options.italics = italics;
    cardDataObj.options.animate = animate;
    cardDataObj.options.svgColor = svgColor;
    if (svgBackground) {
      cardDataObj.options.svgBackground = svgBackground;
    }
    const jsonString = JSON.stringify(cardDataObj, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const fileName = formatCardFilename(setNumber, order);
    const { error } = await supabaseClient.storage
      .from('card')
      .upload(fileName, blob, {
        contentType: 'application/json',
        upsert: true
      });
    if (error) {
      console.error('Failed to save card:', error);
      return;
    }
    const key = `${setNumber}.${order}`;
    cardData.set(key, cardDataObj);
    await displaySet(currentSetNumber);
    closeCardEditor();
  } catch (error) {
    console.error('Error saving card:', error);
  }
}
function showDeleteModal() {
  const modal = document.getElementById('deleteModal');
  modal.style.display = 'flex';
}
function hideDeleteModal() {
  const modal = document.getElementById('deleteModal');
  modal.style.display = 'none';
  cardToDelete = null;
}
async function deleteCard() {
  if (!cardToDelete) return;
  try {
    const { set, order } = cardToDelete;
    const fileName = formatCardFilename(set, order);
    const { error } = await supabaseClient.storage
      .from('card')
      .remove([fileName]);
    if (error) {
      console.error(`Failed to delete card ${set}.${order}:`, error);
      return;
    }
    const key = `${set}.${order}`;
    cardData.delete(key);
    if (cardToDelete.element) {
      cardToDelete.element.remove();
    }
    await scanAllSets();
    const currentSetInfo = setInfo.get(currentSetNumber);
    const isSetEmpty = !currentSetInfo || currentSetInfo.cardCount === 0;
    const isSetRemoved = !availableSets.includes(currentSetNumber);
    const isLastSet = currentSetNumber === Math.max(...availableSets);
    if ((isSetEmpty || isSetRemoved) && availableSets.length > 0) {
      const newCurrentSet = Math.max(...availableSets);
      const oldSetNumber = currentSetNumber;
      currentSetNumber = newCurrentSet;
      await displaySet(currentSetNumber);
    } else {
      await displaySet(currentSetNumber);
    }
  } catch (error) {
    console.error('Error deleting card:', error);
  } finally {
    hideDeleteModal();
  }
}
async function copyCard() {
  if (!cardToCopy) {
    return;
  }
  try {
    const { set, order } = cardToCopy;
    const key = `${set}.${order}`;
    let originalCardData = cardData.get(key);
    if (!originalCardData) {
      originalCardData = await loadCardData(set, order);
      if (!originalCardData) {
        console.error(`Failed to load card ${set}.${order} for copying`);
        return;
      }
    }
    const copiedCardData = JSON.parse(JSON.stringify(originalCardData));
    if (copiedCardData.options) {
      copiedCardData.options.position = null;
    }
    const currentSetInfo = setInfo.get(currentSetNumber);
    let targetSet = currentSetNumber;
    let nextOrder = 1;
    if (currentSetInfo) {
      const usedOrders = currentSetInfo.cards.map(c => c.order);
      while (usedOrders.includes(nextOrder)) {
        nextOrder++;
      }
      if (nextOrder > 15) {
        const availableSets = Array.from(setInfo.keys()).sort((a, b) => a - b);
        let foundSet = null;
        for (const setNum of availableSets) {
          const targetSetInfo = setInfo.get(setNum);
          if (targetSetInfo && targetSetInfo.cards.length < 15) {
            foundSet = setNum;
            break;
          }
        }
        if (foundSet) {
          targetSet = foundSet;
          const targetSetInfo = setInfo.get(targetSet);
          const usedOrders = targetSetInfo.cards.map(c => c.order);
          nextOrder = 1;
          while (usedOrders.includes(nextOrder)) {
            nextOrder++;
          }
        } else {
          targetSet = Math.max(...availableSets) + 1;
          nextOrder = 1;
        }
      }
    }
    const newFileName = formatCardFilename(targetSet, nextOrder);
    const jsonString = JSON.stringify(copiedCardData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const { error } = await supabaseClient.storage
      .from('card')
      .upload(newFileName, blob, {
        contentType: 'application/json',
        upsert: true
      });
    if (error) {
      console.error(`Failed to save copied card ${targetSet}.${nextOrder}:`, error);
      return;
    }
    cardData.set(`${targetSet}.${nextOrder}`, copiedCardData);
    await scanAllSets();
    if (targetSet !== currentSetNumber) {
      currentSetNumber = targetSet;
    }
    await displaySet(currentSetNumber);
  } catch (error) {
    console.error('Error copying card:', error);
  } finally {
    cardToCopy = null;
  }
}
async function moveCardToSet(fromSet, cardOrder, toSet) {
  try {
    const key = `${fromSet}.${cardOrder}`;
    let cardDataObj = cardData.get(key);
    if (!cardDataObj) {
      cardDataObj = await loadCardData(fromSet, cardOrder);
      if (!cardDataObj) return;
    }
    const targetSetInfo = setInfo.get(toSet);
    let nextOrder = 1;
    if (targetSetInfo) {
      const usedOrders = targetSetInfo.cards.map(c => c.order);
      while (usedOrders.includes(nextOrder)) {
        nextOrder++;
      }
    }
    const oldFileName = formatCardFilename(fromSet, cardOrder);
    await supabaseClient.storage.from('card').remove([oldFileName]);
    if (cardDataObj.options) {
      cardDataObj.options.position = null;
    }
    const newFileName = formatCardFilename(toSet, nextOrder);
    const jsonString = JSON.stringify(cardDataObj, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    await supabaseClient.storage
      .from('card')
      .upload(newFileName, blob, { contentType: 'application/json', upsert: true });
    cardData.delete(key);
    cardData.set(`${toSet}.${nextOrder}`, cardDataObj);
    await scanAllSets();
    currentSetNumber = toSet;
    await displaySet(toSet);
    const trashCan = document.getElementById('trashCan');
    const copyButton = document.getElementById('copyButton');
    if (trashCan) {
      trashCan.classList.remove('show');
      trashCan.classList.remove('drag-over');
    }
    if (copyButton) {
      copyButton.classList.remove('show');
      copyButton.classList.remove('drag-over');
    }
  } catch (error) {
    console.error('Error moving card to set:', error);
  }
}
function updateNavigationAreas() {
  const currentIndex = availableSets.indexOf(currentSetNumber);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < availableSets.length - 1;
  const prevArea = document.getElementById('prevSetArea');
  const nextArea = document.getElementById('nextSetArea');
  if (prevArea) {
    if (canGoPrev) {
      prevArea.classList.remove('disabled');
    } else {
      prevArea.classList.add('disabled');
    }
  }
  if (nextArea) {
    if (canGoNext) {
      nextArea.classList.remove('disabled');
    } else {
      nextArea.classList.add('disabled');
    }
  }
}
function goToNextSet() {
  const currentIndex = availableSets.indexOf(currentSetNumber);
  if (currentIndex < availableSets.length - 1) {
    currentSetNumber = availableSets[currentIndex + 1];
    displaySet(currentSetNumber);
  }
}
function goToPreviousSet() {
  const currentIndex = availableSets.indexOf(currentSetNumber);
  if (currentIndex > 0) {
    currentSetNumber = availableSets[currentIndex - 1];
    displaySet(currentSetNumber);
  }
}
function findNonFullSet(direction = 'next') {
  const currentIndex = availableSets.indexOf(currentSetNumber);
  const setsToCheck = direction === 'next' 
    ? availableSets.slice(currentIndex + 1)
    : availableSets.slice(0, currentIndex).reverse();
  for (const setNum of setsToCheck) {
    const info = setInfo.get(setNum);
    if (info && info.cardCount < 15) {
      return setNum;
    }
  }
  return null;
}
document.getElementById('nextSetArea').addEventListener('click', goToNextSet);
document.getElementById('prevSetArea').addEventListener('click', goToPreviousSet);
document.getElementById('individualCard').addEventListener('click', hideIndividualCard);
document.getElementById('confirmDelete').addEventListener('click', deleteCard);
document.getElementById('cancelDelete').addEventListener('click', hideDeleteModal);
document.getElementById('cancelEdit').addEventListener('click', closeCardEditor);
document.getElementById('saveCard').addEventListener('click', saveCard);
document.getElementById('editorSize').addEventListener('input', (e) => {
  document.getElementById('editorSizeValue').textContent = e.target.value;
  updateEditorPreview();
});
document.getElementById('editorBackground').addEventListener('change', updateEditorPreview);
document.getElementById('editorBackground2').addEventListener('change', updateEditorPreview);
document.getElementById('editorItalics').addEventListener('change', updateEditorPreview);
document.getElementById('editorSvgColor').addEventListener('change', updateEditorPreview);
document.getElementById('editorSvg').addEventListener('input', updateEditorPreview);
document.getElementById('editorRule').addEventListener('input', (e) => {
  // Rule field is a plain textarea, no highlighting needed
  updateEditorOutput();
  updateEditorPreview();
});
document.getElementById('editorInput').addEventListener('input', (e) => {
  // Use a small timeout to let the content settle
  setTimeout(() => {
    highlightEditor(e.target);
    updateEditorOutput();
    updateEditorPreview();
  }, 10);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const individualView = document.getElementById('individualCardView');
    const deleteModal = document.getElementById('deleteModal');
    const cardEditorModal = document.getElementById('cardEditorModal');
    if (individualView.style.display === 'flex') {
      hideIndividualCard();
    } else if (deleteModal.style.display === 'flex') {
      hideDeleteModal();
    } else if (cardEditorModal.style.display === 'flex') {
      closeCardEditor();
    }
  }
  
  // Arrow keys to switch sets (only when no modals are open and no input is focused)
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const individualView = document.getElementById('individualCardView');
    const deleteModal = document.getElementById('deleteModal');
    const cardEditorModal = document.getElementById('cardEditorModal');
    const isInputFocused = document.activeElement && (
      document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'TEXTAREA' ||
      document.activeElement.tagName === 'SELECT'
    );
    
    if (individualView.style.display !== 'flex' &&
        deleteModal.style.display !== 'flex' &&
        cardEditorModal.style.display !== 'flex' &&
        !isInputFocused) {
      if (e.key === 'ArrowLeft') {
        goToPreviousSet();
      } else if (e.key === 'ArrowRight') {
        goToNextSet();
      }
    }
  }
});
async function initialize() {
  await scanAllSets();
  if (availableSets.length > 0) {
    currentSetNumber = availableSets[0];
    displaySet(currentSetNumber);
  }
}
initialize();