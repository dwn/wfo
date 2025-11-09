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
function toggleAccordion(header) {
  const accordion = header.parentElement;
  accordion.classList.toggle('collapsed');
}
function openCardEditor(setNumber, order, cardData) {
  currentEditingCard = { setNumber, order, cardData };
  hideInstructionsModal();
  document.getElementById('editorOrder').value = order || '';
  document.getElementById('editorSize').value = cardData.options?.size || 5;
  document.getElementById('editorSizeValue').textContent = cardData.options?.size || 5;
  document.getElementById('editorBackground').value = cardData.options?.backgroundColor || 'transparent';
  document.getElementById('editorBackground2').value = cardData.options?.backgroundColor2 || '';
  document.getElementById('editorItalics').checked = cardData.options?.italics !== false;
  document.getElementById('animatePreview').checked = cardData.options?.animate === true;
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
  hideInstructionsModal();
  currentEditingCard = null;
}


function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateEditorOutput() {
  const ruleEl = document.getElementById('editorRule');
  const inputEl = document.getElementById('editorInput');
  const outputEl = document.getElementById('editorOutput');
  
  const rule = ruleEl ? ruleEl.value : '';
  const input = inputEl ? inputEl.value : '';
  
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
  
  if (outputEl) {
    outputEl.value = output;
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
    const s = 8;
    const pad = { left: 3, top: 3, right: 3 };
    const gridX = Math.floor(canvas.width / s);
    const { ops, visited } = buildOps(coloredItems, s, pad, gridX, bgColor);
    
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
document.getElementById('editorSvgColor').addEventListener('change', updateEditorPreview);
document.getElementById('editorSvg').addEventListener('input', updateEditorPreview);
document.getElementById('editorRule').addEventListener('input', (e) => {
  // Rule field is a plain textarea, no highlighting needed
  updateEditorOutput();
  updateEditorPreview();
});
document.getElementById('editorInput').addEventListener('input', () => {
  updateEditorOutput();
  updateEditorPreview();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const instructionsModal = document.getElementById('instructionsModal');
    if (instructionsModal && instructionsModal.style.display === 'flex') {
      hideInstructionsModal();
      return;
    }
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
    const instructionsModal = document.getElementById('instructionsModal');
    const individualView = document.getElementById('individualCardView');
    const deleteModal = document.getElementById('deleteModal');
    const cardEditorModal = document.getElementById('cardEditorModal');
    const isInputFocused = document.activeElement && (
      document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'TEXTAREA' ||
      document.activeElement.tagName === 'SELECT'
    );
    
    if ((!instructionsModal || instructionsModal.style.display !== 'flex') &&
        individualView.style.display !== 'flex' &&
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