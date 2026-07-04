let cardData = new Map();
let setInfo = new Map();
let currentSetNumber = 1;
let availableSets = [];

const SPEED_OF_LIGHT_THZ_NM = 299792.458;

const SPECTRUM_COLORS = [
  { value: '#700000', name: 'Crimson', nm: 736 },
  { value: '#B00000', name: 'Red', nm: 695 },
  { value: '#DC0000', name: 'Scarlet', nm: 656 },
  { value: '#FF7B00', name: 'Orange', nm: 619 },
  { value: '#FFF200', name: 'Yellow', nm: 585 },
  { value: '#A6FF00', name: 'Lime', nm: 552 },
  { value: '#36FF00', name: 'Green', nm: 520 },
  { value: '#00FFF5', name: 'Cyan', nm: 491 },
  { value: '#008EFF', name: 'Sky', nm: 463 },
  { value: '#0060FF', name: 'Blue', nm: 437 },
  { value: '#6600CC', name: 'Purple', nm: 413 },
  { value: '#4B0080', name: 'Violet', nm: 389 },
  { value: '#000000', name: 'Black', nm: 368 },
];

const SPECTRUM_BASE_NM = 736;

function frequencyTHz(nm) {
  return SPEED_OF_LIGHT_THZ_NM / nm;
}

function formatFrequencyTHz(nm) {
  return frequencyTHz(nm).toFixed(1);
}

function pitchCentsFromBase(nm) {
  const ratio = frequencyTHz(nm) / frequencyTHz(SPECTRUM_BASE_NM);
  return Math.round(1200 * Math.log2(ratio));
}

function formatPitchCents(nm) {
  const cents = pitchCentsFromBase(nm);
  if (cents === 0) return '0¢';
  return cents > 0 ? `+${cents}¢` : `${cents}¢`;
}

function spectrumOptionLabel(entry) {
  return `${entry.name} (${entry.value}) - ${entry.nm}nm, ${formatFrequencyTHz(entry.nm)} THz, ${formatPitchCents(entry.nm)}`;
}

function populateBackgroundSelect(selectEl, includeNone) {
  selectEl.innerHTML = '';
  if (includeNone) {
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'None';
    selectEl.appendChild(none);
  }
  const transparent = document.createElement('option');
  transparent.value = 'transparent';
  transparent.textContent = 'Transparent';
  selectEl.appendChild(transparent);
  for (const entry of SPECTRUM_COLORS) {
    const opt = document.createElement('option');
    opt.value = entry.value;
    opt.textContent = spectrumOptionLabel(entry);
    selectEl.appendChild(opt);
  }
  for (const entry of [
    { value: '#808080', label: 'Gray (#808080)' },
    { value: '#FFFFFF', label: 'White (#FFFFFF)' },
  ]) {
    const opt = document.createElement('option');
    opt.value = entry.value;
    opt.textContent = entry.label;
    selectEl.appendChild(opt);
  }
}

function initBackgroundColorSelects() {
  populateBackgroundSelect(document.getElementById('editorBackground'), false);
  populateBackgroundSelect(document.getElementById('editorBackground2'), true);
}

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

async function loadCardData(set, order) {
  try {
    const filename = formatCardFilename(set, order);
    return await cardStorage.readJson(filename);
  } catch (error) {
    console.error(`Failed to load card ${set}.${order}:`, error);
    return null;
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
                newSetNumber = direction === 'next' ? 1 : 0;
              } else {
                newSetNumber = direction === 'next' ? Math.max(...availableSets) + 1 : Math.min(...availableSets) - 1;
              }
              if (newSetNumber >= 0) {
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
    const fileName = formatCardFilename(set, order);
    await cardStorage.put(fileName, cardDataObj);
  } catch (error) {
    console.error(`Error updating position for ${set}.${order}:`, error);
  }
}
function applyCardIndexList(filenames, options = {}) {
  const extendThrough = options.extendThrough ?? 0;
  const sets = new Map();
  let maxSetFound = 0;
  for (const name of filenames) {
    const parsed = parseCardFilename(name);
    if (parsed) {
      if (!sets.has(parsed.set)) {
        sets.set(parsed.set, []);
      }
      sets.get(parsed.set).push(parsed);
      maxSetFound = Math.max(maxSetFound, parsed.set);
    }
  }
  const maxSet = Math.max(maxSetFound, extendThrough);
  availableSets = [];
  for (let setNum = 0; setNum <= maxSet; setNum++) {
    const cards = sets.get(setNum) || [];
    const sortedCards = cards.sort((a, b) => a.order - b.order);
    setInfo.set(setNum, {
      cardCount: cards.length,
      cards: sortedCards
    });
    availableSets.push(setNum);
  }
}
async function scanAllSets(options = {}) {
  try {
    const names = await cardStorage.listFilenames();
    applyCardIndexList(names, options);
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
      const fileName = formatCardFilename(setNumber, order);
      try {
        await cardStorage.put(fileName, data);
        const key = `${setNumber}.${order}`;
        cardData.set(key, data);
      } catch (err) {
        console.error(`Failed to fix position for card ${setNumber}.${order}:`, err);
      }
    }
    await scanAllSets();
  } catch (error) {
    console.error('Error fixing card positions:', error);
  }
}
function toggleAccordion(header) {
  const accordion = header.parentElement;
  accordion.classList.toggle('collapsed');
}
function resetRuleFocus() {
  const grid = document.querySelector('#cardEditorModal .editor-grid');
  const btn = document.getElementById('editorRuleFocusBtn');
  if (grid) grid.classList.remove('rule-focused');
  if (btn) {
    btn.setAttribute('aria-pressed', 'false');
    btn.title = 'Expand Rule';
    btn.setAttribute('aria-label', 'Expand Rule');
    btn.textContent = '⛶';
  }
}
function toggleRuleFocus() {
  const grid = document.querySelector('#cardEditorModal .editor-grid');
  const btn = document.getElementById('editorRuleFocusBtn');
  const ruleEl = document.getElementById('editorRule');
  if (!grid || !btn) return;
  const focused = !grid.classList.contains('rule-focused');
  grid.classList.toggle('rule-focused', focused);
  btn.setAttribute('aria-pressed', focused ? 'true' : 'false');
  btn.title = focused ? 'Show all sections' : 'Expand Rule';
  btn.setAttribute('aria-label', btn.title);
  btn.textContent = focused ? '⤡' : '⛶';
  if (focused && ruleEl) ruleEl.focus();
}
function openCardEditor(setNumber, order, cardData) {
  resetRuleFocus();
  currentEditingCard = { setNumber, order, cardData };
  hideInstructionsModal();
  document.getElementById('editorOrder').value = order || '';
  document.getElementById('editorSize').value = cardData.options?.size || 5;
  document.getElementById('editorSizeValue').textContent = cardData.options?.size || 5;
  document.getElementById('editorBackground').value = cardData.options?.backgroundColor || 'transparent';
  document.getElementById('editorBackground2').value = cardData.options?.backgroundColor2 || '';
  document.getElementById('editorItalics').checked = cardData.options?.italics !== false;
  document.getElementById('animatePreview').checked = cardData.options?.animate === true;
  document.getElementById('editorCalligraphy').checked = cardData.options?.calligraphy === true;
  document.getElementById('editorCenter').checked = cardData.options?.center === true;
  document.getElementById('editorCenterVertical').checked = cardData.options?.centerVertical === true;
  document.getElementById('editorSvgColor').checked = cardData.options?.svgColor === true;
  document.getElementById('editorSvg').value = cardData.options?.svgBackground || '';
  
  // Handle textarea elements
  const ruleEl = document.getElementById('editorRule');
  const inputEl = document.getElementById('editorInput');
  const outputEl = document.getElementById('editorOutput');
  ruleEl.value = cardData.rule || '';
  inputEl.value = cardData.input || '';
  
  // Initialize output and preview after a brief delay
  setTimeout(() => {
    updateEditorOutput().then(() => updateEditorPreview());
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
  resetRuleFocus();
  document.getElementById('cardEditorModal').style.display = 'none';
  hideInstructionsModal();
  currentEditingCard = null;
}
function updateEditorOutput() {
  const ruleEl = document.getElementById('editorRule');
  const inputEl = document.getElementById('editorInput');
  const outputEl = document.getElementById('editorOutput');
  
  const rule = ruleEl ? ruleEl.value : '';
  const input = inputEl ? inputEl.value : '';

  const applyResolved = async () => {
    let resolvedInput = input;
    let resolvedRule = rule;
    if (typeof resolveReferencedInput === 'function') {
      resolvedInput = await resolveReferencedInput(input);
    }
    if (typeof resolveReferencedRule === 'function') {
      resolvedRule = await resolveReferencedRule(rule);
    }
    return applyRuleTransforms(resolvedInput, resolvedRule);
  };

  if (typeof resolveReferencedRule !== 'function' && typeof resolveReferencedInput !== 'function') {
    const output = applyRuleTransforms(input, rule);
    if (outputEl) outputEl.value = output;
    return Promise.resolve();
  }

  return applyResolved().then((output) => {
    if (outputEl) outputEl.value = output;
  });
}

function updateEditorPreview() {
  const canvas = document.getElementById('editorCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  canvas.style.background = '#000000';
  
  const bgColor = document.getElementById('editorBackground').value;
  const bgColor2 = document.getElementById('editorBackground2').value;
  
  const outputEl = document.getElementById('editorOutput');
  const output = outputEl ? outputEl.value : '';
  
  if (!output) {
  ctx.fillStyle = '#666';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Card Preview', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  try {
    const coloredItems = parseBytes(output);
    const s = normalizeDrawingSize(document.getElementById('editorSize')?.value);
    const pad = { left: 3, top: 3, right: 3 };
    const gridX = Math.floor(canvas.width / s);
    const centerMode = document.getElementById('editorCenter')?.checked === true;
    const centerVerticalMode = document.getElementById('editorCenterVertical')?.checked === true;
    const italicsCheckbox = document.getElementById('editorItalics');
    const italicsMode = italicsCheckbox ? italicsCheckbox.checked : false;
    const calligraphyCheckbox = document.getElementById('editorCalligraphy');
    const calligraphyMode = calligraphyCheckbox ? calligraphyCheckbox.checked : false;
    const thickness = s / 10;
    const { ops, visited, pipes, starts } = buildOps(coloredItems, s, pad, gridX, bgColor, {
      center: centerMode,
      centerVertical: centerVerticalMode,
      canvasHeight: canvas.height,
      italics: italicsMode,
      thickness,
      strokeLayer: 'main',
    });
    
    // Always draw static preview in editor mode
    drawGridPoints(ctx, s, canvas.width, canvas.height, thickness, italicsMode);
    // Editor mode: draw white text only, no outline; anchor markers last so they stay visible
    for (const op of ops) {
      drawOp(ctx, op, s, thickness, italicsMode, bgColor, true, calligraphyMode);
    }
    drawEditorAnchorMarkers(ctx, starts, pipes, s, italicsMode);
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
    const size = parseInt(document.getElementById('editorSize').value);
    const backgroundColor = document.getElementById('editorBackground').value;
    const backgroundColor2 = document.getElementById('editorBackground2').value;
    const italics = document.getElementById('editorItalics').checked;
    const animate = document.getElementById('animatePreview').checked;
    const calligraphy = document.getElementById('editorCalligraphy').checked;
    const center = document.getElementById('editorCenter').checked;
    const centerVertical = document.getElementById('editorCenterVertical').checked;
    const svgColor = document.getElementById('editorSvgColor').checked;
    const svgBackground = document.getElementById('editorSvg').value;
    const ruleEl = document.getElementById('editorRule');
    const inputEl = document.getElementById('editorInput');
    const rule = ruleEl ? ruleEl.value : '';
    const input = inputEl ? inputEl.value : '';
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
    cardDataObj.options.calligraphy = calligraphy;
    cardDataObj.options.center = center;
    cardDataObj.options.centerVertical = centerVertical;
    cardDataObj.options.svgColor = svgColor;
    if (svgBackground) {
      cardDataObj.options.svgBackground = svgBackground;
    } else {
      delete cardDataObj.options.svgBackground;
    }
    const fileName = formatCardFilename(setNumber, order);
    await cardStorage.put(fileName, cardDataObj);
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
function showInstructionsModal() {
  const modal = document.getElementById('instructionsModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}
function hideInstructionsModal() {
  const modal = document.getElementById('instructionsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}
async function deleteCard() {
  if (!cardToDelete) return;
  try {
    const { set, order } = cardToDelete;
    const fileName = formatCardFilename(set, order);
    await cardStorage.delete(fileName);
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
    await cardStorage.put(newFileName, copiedCardData);
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
    await cardStorage.delete(oldFileName);
    if (cardDataObj.options) {
      cardDataObj.options.position = null;
    }
    const newFileName = formatCardFilename(toSet, nextOrder);
    await cardStorage.put(newFileName, cardDataObj);
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
function parseSetFromHash(hash) {
  if (!hash || hash === '#') {
    return null;
  }
  const m = /^#(\d+)$/.exec(hash);
  if (!m) {
    return null;
  }
  const n = parseInt(m[1], 10);
  return n >= 0 ? n : null;
}
function syncUrlFragment() {
  const fragment = `#${currentSetNumber}`;
  const nextUrl = `${location.pathname}${location.search}${fragment}`;
  if (`${location.pathname}${location.search}${location.hash}` === nextUrl) {
    return;
  }
  history.replaceState(null, '', nextUrl);
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
  const swapLeftButton = document.getElementById('swapSetLeftButton');
  const swapRightButton = document.getElementById('swapSetRightButton');
  if (swapLeftButton) {
    swapLeftButton.disabled = !canGoPrev;
  }
  if (swapRightButton) {
    swapRightButton.disabled = !canGoNext;
  }
  syncUrlFragment();
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
async function requestInsertBlankSetAfter(after) {
  if (typeof cardStorage.insertBlankSetAfter === 'function') {
    return cardStorage.insertBlankSetAfter(after);
  }
  const res = await fetch('/api/insert-blank-set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ after }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `insert-blank-set ${res.status}`);
  }
  return res.json();
}
async function insertBlankSetAfterCurrent() {
  try {
    const after = currentSetNumber;
    const { insertedSet } = await requestInsertBlankSetAfter(after);
    cardData.clear();
    await scanAllSets({ extendThrough: insertedSet });
    currentSetNumber = insertedSet;
    await displaySet(currentSetNumber);
  } catch (error) {
    console.error('Error inserting blank set:', error);
  }
}
async function requestInsertSetCopyAfter(after) {
  if (typeof cardStorage.insertSetCopyAfter === 'function') {
    return cardStorage.insertSetCopyAfter(after);
  }
  const res = await fetch('/api/insert-set-copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ after }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `insert-set-copy ${res.status}`);
  }
  return res.json();
}
async function requestDeleteSet(setNum) {
  if (typeof cardStorage.deleteSet === 'function') {
    return cardStorage.deleteSet(setNum);
  }
  const res = await fetch('/api/delete-set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ set: setNum }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `delete-set ${res.status}`);
  }
  return res.json();
}
async function requestSwapSets(setA, setB) {
  if (typeof cardStorage.swapSets === 'function') {
    return cardStorage.swapSets(setA, setB);
  }
  const res = await fetch('/api/swap-sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ a: setA, b: setB }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `swap-sets ${res.status}`);
  }
  return res.json();
}
async function swapCurrentSetWithNeighbor(direction) {
  const currentIndex = availableSets.indexOf(currentSetNumber);
  const neighborIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
  if (neighborIndex < 0 || neighborIndex >= availableSets.length) {
    return;
  }
  const neighborSet = availableSets[neighborIndex];
  try {
    await requestSwapSets(currentSetNumber, neighborSet);
    cardData.clear();
    await scanAllSets();
    await displaySet(currentSetNumber);
  } catch (error) {
    console.error('Error swapping sets:', error);
  }
}
function hideDeleteSetModal() {
  const el = document.getElementById('deleteSetModal');
  if (el) el.style.display = 'none';
}
async function insertSetCopyAfterCurrent() {
  try {
    const after = currentSetNumber;
    const { insertedSet } = await requestInsertSetCopyAfter(after);
    cardData.clear();
    await scanAllSets({ extendThrough: insertedSet });
    currentSetNumber = insertedSet;
    await displaySet(currentSetNumber);
  } catch (error) {
    console.error('Error duplicating set:', error);
  }
}
function onDeleteCurrentSetClick() {
  const n = setInfo.get(currentSetNumber)?.cardCount ?? 0;
  if (n === 0) {
    runDeleteCurrentSet();
    return;
  }
  const body = document.getElementById('deleteSetModalBody');
  body.textContent =
    `Remove all ${n} card${n === 1 ? '' : 's'} in set ${currentSetNumber}. ` +
    'Later sets will be renumbered one step lower. This cannot be undone.';
  document.getElementById('deleteSetModal').style.display = 'flex';
}
async function runDeleteCurrentSet() {
  hideDeleteSetModal();
  const deleted = currentSetNumber;
  try {
    await requestDeleteSet(deleted);
    cardData.clear();
    await scanAllSets();
    if (availableSets.length === 0) {
      currentSetNumber = 0;
      await displaySet(1);
    } else {
      const maxSet = Math.max(...availableSets);
      currentSetNumber = Math.min(deleted, maxSet);
      await displaySet(currentSetNumber);
    }
  } catch (error) {
    console.error('Error deleting set:', error);
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
function closeSetMenu() {
  const root = document.getElementById('setMenuRoot');
  const toggle = document.getElementById('setMenuToggle');
  if (!root || !toggle) return;
  root.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
}
function toggleSetMenu() {
  const root = document.getElementById('setMenuRoot');
  const toggle = document.getElementById('setMenuToggle');
  if (!root || !toggle) return;
  const open = !root.classList.contains('open');
  root.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}
document.getElementById('nextSetArea').addEventListener('click', goToNextSet);
document.getElementById('prevSetArea').addEventListener('click', goToPreviousSet);
document.getElementById('swapSetLeftButton').addEventListener('click', () => swapCurrentSetWithNeighbor('left'));
document.getElementById('swapSetRightButton').addEventListener('click', () => swapCurrentSetWithNeighbor('right'));
document.getElementById('newBlankSetButton').addEventListener('click', insertBlankSetAfterCurrent);
document.getElementById('copySetButton').addEventListener('click', insertSetCopyAfterCurrent);
document.getElementById('deleteCurrentSetButton').addEventListener('click', onDeleteCurrentSetClick);
document.getElementById('setMenuToggle').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSetMenu();
});
document.addEventListener('click', (e) => {
  const root = document.getElementById('setMenuRoot');
  if (!root || !root.classList.contains('open')) return;
  if (!root.contains(e.target)) {
    closeSetMenu();
  }
});
document.getElementById('setToolbar').addEventListener('click', (e) => {
  if (e.target.closest('.toolbar-btn')) {
    queueMicrotask(() => closeSetMenu());
  }
});
document.getElementById('confirmDeleteSet').addEventListener('click', () => runDeleteCurrentSet());
document.getElementById('cancelDeleteSet').addEventListener('click', hideDeleteSetModal);
document.getElementById('deleteSetModal').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) {
    hideDeleteSetModal();
  }
});
document.getElementById('individualCard').addEventListener('click', hideIndividualCard);
document.getElementById('confirmDelete').addEventListener('click', deleteCard);
document.getElementById('cancelDelete').addEventListener('click', hideDeleteModal);
document.getElementById('cancelEdit').addEventListener('click', closeCardEditor);
document.getElementById('saveCard').addEventListener('click', saveCard);
document.getElementById('showInstructions').addEventListener('click', showInstructionsModal);
document.getElementById('ackInstructions').addEventListener('click', hideInstructionsModal);
document.getElementById('instructionsModal').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) {
    hideInstructionsModal();
  }
});
document.getElementById('editorSize').addEventListener('input', (e) => {
  document.getElementById('editorSizeValue').textContent = e.target.value;
  updateEditorPreview();
});
document.getElementById('editorBackground').addEventListener('change', updateEditorPreview);
document.getElementById('editorBackground2').addEventListener('change', updateEditorPreview);
document.getElementById('editorItalics').addEventListener('change', updateEditorPreview);
document.getElementById('editorCalligraphy').addEventListener('change', updateEditorPreview);
document.getElementById('editorCenter').addEventListener('change', updateEditorPreview);
document.getElementById('editorCenterVertical').addEventListener('change', updateEditorPreview);
document.getElementById('editorSvgColor').addEventListener('change', updateEditorPreview);
document.getElementById('editorSvg').addEventListener('input', updateEditorPreview);
document.getElementById('editorRuleFocusBtn').addEventListener('click', toggleRuleFocus);
document.getElementById('editorRule').addEventListener('input', () => {
  // Rule field is a plain textarea, no highlighting needed
  updateEditorOutput().then(() => updateEditorPreview());
});
document.getElementById('editorInput').addEventListener('input', () => {
  updateEditorOutput().then(() => updateEditorPreview());
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const instructionsModal = document.getElementById('instructionsModal');
    if (instructionsModal && instructionsModal.style.display === 'flex') {
      hideInstructionsModal();
      return;
    }
    const setMenuRoot = document.getElementById('setMenuRoot');
    if (setMenuRoot && setMenuRoot.classList.contains('open')) {
      closeSetMenu();
      return;
    }
    const individualView = document.getElementById('individualCardView');
    const deleteSetModal = document.getElementById('deleteSetModal');
    const deleteModal = document.getElementById('deleteModal');
    const cardEditorModal = document.getElementById('cardEditorModal');
    if (individualView.style.display === 'flex') {
      hideIndividualCard();
    } else if (deleteSetModal && deleteSetModal.style.display === 'flex') {
      hideDeleteSetModal();
    } else if (deleteModal.style.display === 'flex') {
      hideDeleteModal();
    } else if (cardEditorModal.style.display === 'flex') {
      closeCardEditor();
    }
  }
  
  // Arrow keys: barrel-roll cards in closeup view, or switch sets on the grid
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const instructionsModal = document.getElementById('instructionsModal');
    const individualView = document.getElementById('individualCardView');
    const deleteSetModal = document.getElementById('deleteSetModal');
    const deleteModal = document.getElementById('deleteModal');
    const cardEditorModal = document.getElementById('cardEditorModal');
    const isInputFocused = document.activeElement && (
      document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'TEXTAREA' ||
      document.activeElement.tagName === 'SELECT'
    );

    if (individualView.style.display === 'flex' && !isInputFocused) {
      e.preventDefault();
      if (e.key === 'ArrowLeft') {
        navigateIndividualCard(-1);
      } else if (e.key === 'ArrowRight') {
        navigateIndividualCard(1);
      }
      return;
    }
    
    if ((!instructionsModal || instructionsModal.style.display !== 'flex') &&
        (!deleteSetModal || deleteSetModal.style.display !== 'flex') &&
        deleteModal.style.display !== 'flex' &&
        cardEditorModal.style.display !== 'flex' &&
        !isInputFocused) {
      if (e.key === 'ArrowLeft') {
        goToPreviousSet();
      } else       if (e.key === 'ArrowRight') {
        goToNextSet();
      }
    }
  }

  // Up/down: switch sets while viewing an individual card
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const individualView = document.getElementById('individualCardView');
    const isInputFocused = document.activeElement && (
      document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'TEXTAREA' ||
      document.activeElement.tagName === 'SELECT'
    );

    if (individualView.style.display === 'flex' && !isInputFocused) {
      e.preventDefault();
      if (e.key === 'ArrowUp') {
        navigateIndividualSet(-1);
      } else {
        navigateIndividualSet(1);
      }
    }
  }

  if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const individualView = document.getElementById('individualCardView');
    const isInputFocused = document.activeElement && (
      document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'TEXTAREA' ||
      document.activeElement.tagName === 'SELECT'
    );

    if (individualView.style.display === 'flex' && !isInputFocused) {
      e.preventDefault();
      editIndividualCard();
    }
  }
});
async function initialize() {
  await scanAllSets();
  const fromHash = parseSetFromHash(location.hash);
  if (availableSets.length > 0) {
    if (fromHash !== null && fromHash >= 0 && availableSets.includes(fromHash)) {
      currentSetNumber = fromHash;
    } else if (availableSets.includes(1)) {
      currentSetNumber = 1;
    } else {
      currentSetNumber = availableSets[0];
    }
    await displaySet(currentSetNumber);
  } else {
    currentSetNumber = 0;
    syncUrlFragment();
  }
}
window.addEventListener('hashchange', () => {
  const raw = parseSetFromHash(location.hash);
  if (raw === null || availableSets.length === 0) {
    syncUrlFragment();
    return;
  }
  const n = availableSets.includes(raw) ? raw : (availableSets.includes(1) ? 1 : availableSets[0]);
  if (n !== currentSetNumber) {
    currentSetNumber = n;
    displaySet(currentSetNumber);
    return;
  }
  if (location.hash !== `#${currentSetNumber}`) {
    syncUrlFragment();
  }
});
if (typeof unicodeKeymap !== 'undefined' && unicodeKeymap.initUnicodeKeymap) {
  unicodeKeymap.initUnicodeKeymap();
}
initBackgroundColorSelects();
initialize();