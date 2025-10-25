// ===== CONFIGURATION =====
const SUPABASE_URL = '{{SUPABASE_URL}}';
const SUPABASE_SERVICE_ROLE_KEY = '{{SUPABASE_SERVICE_ROLE_KEY}}';
const CARD_BASE_URL = `${SUPABASE_URL}/storage/v1/object/public/card/`;
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ===== GLOBAL VARIABLES =====
let cardData = new Map(); // Cache for card data: "set.order" -> cardData
let setInfo = new Map(); // Cache for set information: setNumber -> {cardCount, cards: [{order, position, filename}]}
let currentSetNumber = 1; // Track the current set being displayed
let availableSets = []; // Array of available set numbers

// ===== UTILITY FUNCTIONS =====
/**
 * Format card filename in the new naming convention
 * @param {number} set - Set number
 * @param {number} order - Card order within the set
 * @returns {string} Formatted filename (e.g., "1.2.json")
 */
function formatCardFilename(set, order) {
  return `${set}.${order}.json`;
}

/**
 * Parse card filename to extract set and order numbers
 * @param {string} filename - Card filename (e.g., "1.2.json")
 * @returns {Object|null} Object with set and order properties, or null if invalid
 */
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

/**
 * Generate CSS gradient from hex color
 * @param {string} hexColor - Hex color code or 'transparent'
 * @returns {string} CSS gradient string
 */
function generateGradientFromColor(hexColor) {
  if (hexColor === 'transparent') {
    return 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)';
  }
  
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

// Get color for a card (from options or default)
function getCardColor(cardData) {
  if (cardData && cardData.options && cardData.options.backgroundColor) {
    return cardData.options.backgroundColor;
  }
  return '#808080'; // Default gray
}

// Strip SVG colors to allow CSS inheritance
function stripSvgColors(svgContent, keepNaturalColors = false) {
  if (keepNaturalColors) {
    return svgContent;
  }
  
  let processed = svgContent;
  
  // Remove fill attributes and replace with currentColor
  processed = processed.replace(/fill="[^"]*"/g, 'fill="currentColor"');
  processed = processed.replace(/fill='[^']*'/g, "fill='currentColor'");
  
  // Remove stroke attributes and replace with currentColor, or set to none for thin strokes
  processed = processed.replace(/stroke="[^"]*"/g, 'stroke="currentColor"');
  processed = processed.replace(/stroke='[^']*'/g, "stroke='currentColor'");
  
  // Remove stroke-width attributes to eliminate thick strokes
  processed = processed.replace(/\s*stroke-width="[^"]*"/g, '');
  processed = processed.replace(/\s*stroke-width='[^']*'/g, '');
  
  // Remove style attributes that contain fill or stroke
  processed = processed.replace(/\s*style="[^"]*fill:[^;"]*[^"]*"/g, '');
  processed = processed.replace(/\s*style='[^']*fill:[^;']*[^']*'/g, '');
  processed = processed.replace(/\s*style="[^"]*stroke:[^;"]*[^"]*"/g, '');
  processed = processed.replace(/\s*style='[^']*stroke:[^;']*[^']*'/g, '');
  
  return processed;
}

// Create SVG styling (from wfo.html)
function createSvgStyle(hasTransform = false, transformValue = '1', textColor = 'currentColor', useNaturalColors = false) {
  if (useNaturalColors) {
    // Keep original SVG colors - no CSS override
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
    // Apply color inheritance
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

// Calculate text color for SVG
function calculateSvgTextColor(backgroundColor, editorVisible) {
  if (backgroundColor === 'transparent') {
    return editorVisible ? '#000000' : '#ffffff';
  }
  
  const rgb = hexToRgb(backgroundColor);
  const luminosity = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  
  return luminosity > 0.5 ? '#000000' : '#ffffff';
}

// ===== CARD DATA FUNCTIONS =====
/**
 * Load card data from Supabase storage
 * @param {number} set - Set number
 * @param {number} order - Card order within the set
 * @returns {Promise<Object|null>} Card data object or null if not found
 */
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

// ===== DRAWING FUNCTIONS =====
const COLORS = [
  { name: 'bla', hex: '#000000' },
  { name: 'car', hex: '#8c0004' },
  { name: 'red', hex: '#e00000' },
  { name: 'ora', hex: '#f34001' },
  { name: 'amb', hex: '#faaf00' },
  { name: 'yel', hex: '#dbd200' },
  { name: 'grn', hex: '#00cb00' },
  { name: 'cya', hex: '#00dfd8' },
  { name: 'blu', hex: '#3441fc' },
  { name: 'ind', hex: '#4020f0' },
  { name: 'pur', hex: '#8000f0' },
  { name: 'vio', hex: '#350063' },
  { name: 'gry', hex: '#808080' },
  { name: 'wht', hex: '#ffffff' }
];

// Simple drawing function (placeholder - we'll render cards as images or simple representations)
function drawCardPreview(canvas, cardData) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Don't draw background - let CSS gradient show through
  // Background is now handled by CSS gradient on canvas.style.background
  
  // Draw simple text if there's input
  if (cardData && cardData.input) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Card ${cardData.input.substring(0, 10)}...`, canvas.width / 2, canvas.height / 2);
  }
}

// ===== DRAG AND DROP SYSTEM =====
let draggedCard = null;
let dragOffGridTimer = null;
let isDraggingOffGrid = false;
let lastDragX = 0;
let cardToDelete = null; // Store card info for deletion
let cardToCopy = null; // Store card info for copying

/**
 * Set up drag and drop functionality for the grid
 * @param {number} setNumber - Set number for position updates
 */
function setupDragAndDrop(setNumber) {
  const gridEl = document.getElementById('gridContainer');
  
  // Remove any existing drag event listeners to prevent duplicates
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
      e.dataTransfer.setData('text/plain', ''); // Required for some browsers
      
      // Show trash can and copy button
      const trashCan = document.getElementById('trashCan');
      const copyButton = document.getElementById('copyButton');
      if (trashCan) {
        trashCan.classList.add('show');
      }
      if (copyButton) {
        copyButton.classList.add('show');
      }
      
      // Add document-level listener to track drag position
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
    
    // Check if over trash can
    const isOverTrash = (
      e.clientX >= trashRect.left &&
      e.clientX <= trashRect.right &&
      e.clientY >= trashRect.top &&
      e.clientY <= trashRect.bottom
    );
    
    // Check if over copy button
    const isOverCopy = (
      e.clientX >= copyRect.left &&
      e.clientX <= copyRect.right &&
      e.clientY >= copyRect.top &&
      e.clientY <= copyRect.bottom
    );
    
    // Debug logging
    if (isOverCopy) {
      console.log('Dragging over copy button');
    }
    
    // Check if outside grid (but not over copy button or trash can)
    const isOutsideGrid = (
      (e.clientX < gridRect.left || e.clientX > gridRect.right || 
       e.clientY < gridRect.top || e.clientY > gridRect.bottom) &&
      !isOverTrash && !isOverCopy
    );
    
    const prevArea = document.getElementById('prevSetArea');
    const nextArea = document.getElementById('nextSetArea');
    
    // Handle trash can and copy button highlighting
    if (isOverTrash) {
      trashCan.classList.add('drag-over');
      copyButton.classList.remove('drag-over');
      // Clear any existing timers
      if (dragOffGridTimer) {
        clearTimeout(dragOffGridTimer);
        dragOffGridTimer = null;
      }
      // Remove nav area highlights
      prevArea.style.background = '';
      nextArea.style.background = '';
      isDraggingOffGrid = false;
    } else if (isOverCopy) {
      copyButton.classList.add('drag-over');
      trashCan.classList.remove('drag-over');
      // Clear any existing timers
      if (dragOffGridTimer) {
        clearTimeout(dragOffGridTimer);
        dragOffGridTimer = null;
      }
      // Remove nav area highlights
      prevArea.style.background = '';
      nextArea.style.background = '';
      isDraggingOffGrid = false;
    } else {
      trashCan.classList.remove('drag-over');
      copyButton.classList.remove('drag-over');
      
      // Handle navigation areas
      if (isOutsideGrid && !isDraggingOffGrid) {
        isDraggingOffGrid = true;
        const direction = e.clientX < gridRect.left ? 'prev' : 'next';
        console.log('Started dragging off grid, direction:', direction);
        
        // Check if navigation is possible
        const currentIndex = availableSets.indexOf(currentSetNumber);
        const canGoPrev = currentIndex > 0;
        const canGoNext = currentIndex < availableSets.length - 1;
        
        console.log('Navigation check:', {
          currentSetNumber,
          currentIndex,
          availableSets,
          canGoPrev,
          canGoNext,
          direction
        });
        
        // Highlight the appropriate nav area only if navigation is possible
        if (direction === 'prev' && canGoPrev) {
          console.log('Highlighting prev area');
          prevArea.style.background = 'rgba(255, 255, 255, 0.05)';
        } else if (direction === 'next' && canGoNext) {
          console.log('Highlighting next area');
          nextArea.style.background = 'rgba(255, 255, 255, 0.05)';
        } else if (direction === 'next' && !canGoNext) {
          // On the last set, dragging right can create a new set, so highlight the area
          console.log('On last set, highlighting right area for new set creation');
          nextArea.style.background = 'rgba(255, 255, 255, 0.05)';
        } else {
          console.log('Not highlighting any nav area');
        }
        
        // Only start timer if navigation is possible or we can create a new set
        if ((direction === 'prev' && canGoPrev) || (direction === 'next' && (canGoNext || !canGoNext))) {
          dragOffGridTimer = setTimeout(() => {
            console.log('1 second elapsed, finding target set...');
            const targetSet = findNonFullSet(direction);
            console.log('Target set:', targetSet);
            if (targetSet !== null) {
              const draggedOrder = parseInt(draggedCard.getAttribute('data-order'));
              console.log(`Moving card ${currentSetNumber}.${draggedOrder} to set ${targetSet}`);
              moveCardToSet(currentSetNumber, draggedOrder, targetSet);
            } else {
              // No non-full sets available, create a new set
              let newSetNumber;
              if (availableSets.length === 0) {
                newSetNumber = direction === 'next' ? 2 : 1;
              } else {
                newSetNumber = direction === 'next' ? Math.max(...availableSets) + 1 : Math.min(...availableSets) - 1;
              }
              
              if (newSetNumber > 0) { // Only create positive set numbers
                console.log(`Creating new set ${newSetNumber}`);
                const draggedOrder = parseInt(draggedCard.getAttribute('data-order'));
                console.log(`Moving card ${currentSetNumber}.${draggedOrder} to new set ${newSetNumber}`);
                moveCardToSet(currentSetNumber, draggedOrder, newSetNumber);
              } else {
                console.log('Cannot create set with negative number');
              }
            }
            // Remove highlight
            prevArea.style.background = '';
            nextArea.style.background = '';
          }, 1000);
        }
      } else if (!isOutsideGrid && isDraggingOffGrid) {
        console.log('Moved back onto grid, canceling timer');
        clearTimeout(dragOffGridTimer);
        isDraggingOffGrid = false;
        // Remove highlights
        prevArea.style.background = '';
        nextArea.style.background = '';
      }
    }
  }
  
  function handleDragEnd(e) {
    // Remove document listener
    document.removeEventListener('dragover', checkDragOffGrid);
    
    // Clear timer if still running
    if (dragOffGridTimer) {
      clearTimeout(dragOffGridTimer);
      dragOffGridTimer = null;
    }
    isDraggingOffGrid = false;
    
    // Clear nav area highlights
    const prevArea = document.getElementById('prevSetArea');
    const nextArea = document.getElementById('nextSetArea');
    const trashCan = document.getElementById('trashCan');
    const copyButton = document.getElementById('copyButton');
    if (prevArea) prevArea.style.background = '';
    if (nextArea) nextArea.style.background = '';
    // Don't hide trash can yet - we need it for drop detection
    if (e.target.classList.contains('card-wrapper')) {
      e.target.classList.remove('dragging');
      e.target.classList.remove('drag-source');
      const allCards = gridEl.querySelectorAll('.card-wrapper');
      allCards.forEach(card => card.classList.remove('drag-over'));
      
      // Check if dropped on trash can or copy button BEFORE hiding them
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
      
      console.log('Drop detection:', {
        clientX: e.clientX,
        clientY: e.clientY,
        copyRect: copyRect,
        isOverCopy: isOverCopy,
        isOverTrash: isOverTrash,
        copyButtonVisible: copyButton.style.display !== 'none',
        copyButtonClasses: copyButton.className
      });
      
      if (isOverTrash && draggedCard) {
        // Store card info for deletion
        const draggedOrder = parseInt(draggedCard.getAttribute('data-order'));
        cardToDelete = {
          set: currentSetNumber,
          order: draggedOrder,
          element: draggedCard
        };
        showDeleteModal();
      } else if (isOverCopy && draggedCard) {
        console.log('Dropped on copy button, starting copy process');
        // Store card info for copying
        const draggedOrder = parseInt(draggedCard.getAttribute('data-order'));
        cardToCopy = {
          set: currentSetNumber,
          order: draggedOrder,
          element: draggedCard
        };
        console.log('Card to copy set:', cardToCopy);
        copyCard();
      } else {
        console.log('Not dropped on copy button or trash can');
      }
      
      // Hide trash can and copy button after drop detection
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
    
    // Clear all existing drag-over highlights
    const allCards = gridEl.querySelectorAll('.card-wrapper');
    allCards.forEach(card => card.classList.remove('drag-over'));
    
    // Calculate distances to all card centers and find the closest one
    let closestCard = null;
    let closestDistance = Infinity;
    
    for (const card of allCards) {
      // Skip the dragged card itself and empty slots
      if (card === draggedCard || card.classList.contains('empty-slot')) continue;
      
      const cardRect = card.getBoundingClientRect();
      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;
      
      // Calculate distance from mouse to card center
      const distance = Math.sqrt(
        Math.pow(e.clientX - cardCenterX, 2) + 
        Math.pow(e.clientY - cardCenterY, 2)
      );
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestCard = card;
      }
    }
    
    // Highlight the closest card
    if (closestCard) {
      closestCard.classList.add('drag-over');
    }
  }
  
  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedCard) return;
    
    // Find the closest card to the drop point
    let targetCard = null;
    let closestDistance = Infinity;
    const allCards = gridEl.querySelectorAll('.card-wrapper');
    
    for (const card of allCards) {
      // Skip only the dragged card itself (allow empty slots as targets)
      if (card === draggedCard) continue;
      
      const cardRect = card.getBoundingClientRect();
      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;
      
      // Calculate distance from drop point to card center
      const distance = Math.sqrt(
        Math.pow(e.clientX - cardCenterX, 2) + 
        Math.pow(e.clientY - cardCenterY, 2)
      );
      
      if (distance < closestDistance) {
        closestDistance = distance;
        targetCard = card;
      }
    }
    
    // Get the target position from the closest card
    const targetRow = parseInt(targetCard?.style.gridRow) || 1;
    const targetCol = parseInt(targetCard?.style.gridColumn) || 1;
    
    // Get the dragged card's ORIGINAL positions (before any visual updates)
    const originalDraggedRow = parseInt(draggedCard.style.gridRow) || 1;
    const originalDraggedCol = parseInt(draggedCard.style.gridColumn) || 1;
    
    // Check if dropping on the same position
    if (targetRow === originalDraggedRow && targetCol === originalDraggedCol) {
      // No change needed
      targetCard?.classList.remove('drag-over');
      return;
    }
    
    // Use the global current set number
    const currentSet = currentSetNumber;
    
    const draggedOrder = parseInt(draggedCard.getAttribute('data-order'));
    const isTargetEmpty = !targetCard || targetCard.classList.contains('empty-slot');
    const targetOrder = targetCard ? parseInt(targetCard.getAttribute('data-order')) : null;
    
    // If target is an empty slot, we need to find if there's a real card at that position
    if (targetCard && targetCard.classList.contains('empty-slot')) {
      // Look for a real card at the same grid position
      const allRealCards = gridEl.querySelectorAll('.card-wrapper:not(.empty-slot)');
      for (const realCard of allRealCards) {
        const realCardRow = parseInt(realCard.style.gridRow) || 1;
        const realCardCol = parseInt(realCard.style.gridColumn) || 1;
        if (realCardRow === targetRow && realCardCol === targetCol) {
          // Found the real card at this position
          targetCard = realCard;
          break;
        }
      }
    }
    
    // Update isTargetEmpty after potentially finding the real card
    const finalIsTargetEmpty = !targetCard || targetCard.classList.contains('empty-slot');
    
    if (finalIsTargetEmpty) {
      // Move to empty slot - update visual position
      draggedCard.style.gridRow = targetRow;
      draggedCard.style.gridColumn = targetCol;
      
      // Create placeholder at original position
      const originalEmptySlot = document.createElement('div');
      originalEmptySlot.className = 'card-wrapper empty-slot';
      originalEmptySlot.style.gridRow = originalDraggedRow;
      originalEmptySlot.style.gridColumn = originalDraggedCol;
      gridEl.appendChild(originalEmptySlot);
      
      // Save position and wait for completion
      await updateCardPosition(currentSet, draggedOrder, targetRow, targetCol);
    } else {
      // Swap with another card - update visual positions
      const targetOrder = parseInt(targetCard.getAttribute('data-order'));
      
      draggedCard.style.gridRow = targetRow;
      draggedCard.style.gridColumn = targetCol;
      targetCard.style.gridRow = originalDraggedRow;
      targetCard.style.gridColumn = originalDraggedCol;
      
      // Save both positions and wait for completion
      await Promise.all([
        updateCardPosition(currentSet, draggedOrder, targetRow, targetCol),
        updateCardPosition(currentSet, targetOrder, originalDraggedRow, originalDraggedCol)
      ]);
    }
    
    targetCard.classList.remove('drag-over');
  }
  
  // Add the event listeners
  gridEl.addEventListener('dragstart', handleDragStart);
  gridEl.addEventListener('dragend', handleDragEnd);
  gridEl.addEventListener('dragover', handleDragOver);
  gridEl.addEventListener('drop', handleDrop);
}

async function updateCardPosition(set, order, row, col) {
  try {
    const key = `${set}.${order}`;
    let cardDataObj = cardData.get(key);
    
    // If not in cache, load it
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
    
    // Update cache
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

// ===== INDIVIDUAL CARD VIEW =====
/**
 * Show individual card in full-screen view
 * @param {number} setNumber - Set number of the card
 * @param {number} order - Order number of the card
 * @param {Object} cardData - Card data object
 */
async function showIndividualCard(setNumber, order, cardData) {
  const individualView = document.getElementById('individualCardView');
  const individualCard = document.getElementById('individualCard');
  const gridContainer = document.getElementById('gridContainer');
  
  // Remove grid from DOM to prevent CSS interference with SVG rendering
  if (gridContainer) {
    gridContainer.remove();
  }
  
  // Clear previous content
  individualCard.innerHTML = '';
  
  // Create canvas for the individual card
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 848; // 600 * √2 = 600 * 1.41421356 = 848.528
  individualCard.appendChild(canvas);
  
  // Set background
  const bgColor = getCardColor(cardData);
  canvas.style.background = generateGradientFromColor(bgColor);
  
  // Draw card preview
  drawCardPreview(canvas, cardData);
  
  // Load SVG if present
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
      const cardColor = getCardColor(cardData);
      const textColor = calculateSvgTextColor(cardColor, false);
      const useNaturalColors = cardData.options && cardData.options.svgColor === true;
      const cleanedSvg = stripSvgColors(svgContent, useNaturalColors);
      
      const svgContainer = document.createElement('div');
      svgContainer.className = 'svg-container';
      svgContainer.innerHTML = `
        <style>
          .svg-container ${createSvgStyle(false, '1', textColor, useNaturalColors)}
        </style>
        ${cleanedSvg}
      `;
      individualCard.appendChild(svgContainer);
      
      // Force a reflow/repaint to ensure SVG is rendered (from wfo.html)
      svgContainer.offsetHeight;
    }
  }
  
  // Show individual card view
  individualView.style.display = 'flex';
}

/**
 * Hide individual card view and return to grid view
 */
function hideIndividualCard() {
  const individualView = document.getElementById('individualCardView');
  const gridContainer = document.getElementById('gridContainer');
  
  // Hide individual view
  individualView.style.display = 'none';
  
  // Show the grid if it exists, otherwise rebuild it
  if (gridContainer) {
    gridContainer.style.display = 'grid';
  } else {
    // Grid was removed, rebuild it
    displaySet(currentSetNumber);
  }
}

// ===== CACHING SYSTEM =====
async function scanAllSets() {
  try {
    console.log('Scanning all sets...');
    const { data: files, error } = await supabaseClient.storage
      .from('card')
      .list('', { limit: 1000 });
    
    if (error) throw error;
    
    // Group files by set
    const sets = new Map();
    let maxSetFound = 0;
    
    for (const file of files) {
      const parsed = parseCardFilename(file.name);
      if (parsed) {
        console.log(`Found card file: ${file.name} -> set ${parsed.set}, order ${parsed.order}`);
        if (!sets.has(parsed.set)) {
          sets.set(parsed.set, []);
        }
        sets.get(parsed.set).push(parsed);
        maxSetFound = Math.max(maxSetFound, parsed.set);
      } else {
        console.log(`Skipping file (not a card): ${file.name}`);
      }
    }
    
    // Cache set info and build available sets array
    // Include all sets from 1 to maxSetFound, even if empty
    availableSets = [];
    
    for (let setNum = 1; setNum <= maxSetFound; setNum++) {
      const cards = sets.get(setNum) || [];
      const sortedCards = cards.sort((a, b) => a.order - b.order);
      console.log(`Set ${setNum}: ${cards.length} cards found:`, sortedCards.map(c => `${c.set}.${c.order}`));
      setInfo.set(setNum, {
        cardCount: cards.length,
        cards: sortedCards
      });
      availableSets.push(setNum);
    }
    
    console.log('Cached set info:', setInfo);
    
  } catch (error) {
    console.error('Error scanning sets:', error);
  }
}

async function loadCardDataCached(set, order) {
  const key = `${set}.${order}`;
  
  // Return cached data if available
  if (cardData.has(key)) {
    return cardData.get(key);
  }
  
  // Load and cache
  const data = await loadCardData(set, order);
  cardData.set(key, data);
  return data;
}


// ===== GRID DISPLAY SYSTEM =====
/**
 * Fix position conflicts by updating card data files
 * @param {number} setNumber - Set number
 * @param {Array} cardsToFix - Array of cards with new positions
 */
async function fixCardPositions(setNumber, cardsToFix) {
  try {
    for (const cardFix of cardsToFix) {
      const { order, data, newPosition } = cardFix;
      
      // Update the card data with new position
      if (!data.options) data.options = {};
      data.options.position = newPosition;
      
      // Save updated card data
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
        console.log(`Fixed position for card ${setNumber}.${order}: ${newPosition.row}-${newPosition.col}`);
        
        // Update cache
        const key = `${setNumber}.${order}`;
        cardData.set(key, data);
      }
    }
    
    // Rescan sets to update setInfo with new positions
    await scanAllSets();
    console.log('Position fixes completed and sets rescanned');
    
  } catch (error) {
    console.error('Error fixing card positions:', error);
  }
}

/**
 * Display a set of cards in the grid layout
 * @param {number} setNumber - Set number to display
 */
async function displaySet(setNumber) {
  console.log(`displaySet called with setNumber: ${setNumber}`);
  const statusEl = document.getElementById('status');
  
  // Create grid container dynamically if it doesn't exist
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
    // Use cached set info if available, otherwise load all cards
    let loadedCards;
    if (setInfo.has(setNumber)) {
      const setCards = setInfo.get(setNumber).cards;
      const cardPromises = setCards.map(card => 
        loadCardDataCached(setNumber, card.order).then(data => ({ order: card.order, data }))
      );
      loadedCards = await Promise.all(cardPromises);
    } else {
      // Fallback: load all cards for this set
      const cardPromises = [];
      for (let order = 1; order <= 15; order++) {
        cardPromises.push(loadCardDataCached(setNumber, order).then(data => ({ order, data })));
      }
      loadedCards = await Promise.all(cardPromises);
    }
    
    // Create a map of grid positions (row-col) to card data
    const gridPositions = new Map();
    const cardsWithoutPosition = [];
    
    // First pass: place cards that have explicit positions
    const cardsToFix = []; // Track cards that need position fixes
    loadedCards.forEach(({ order, data }) => {
      console.log(`Processing card ${setNumber}.${order}:`, data ? 'has data' : 'no data');
      if (data && data.options && data.options.position) {
        const { row, col } = data.options.position;
        console.log(`Card ${setNumber}.${order} has position: row=${row}, col=${col}`);
        // Only use position if both row and col are valid numbers
        if (row !== null && col !== null && typeof row === 'number' && typeof col === 'number') {
          const key = `${row}-${col}`;
          if (gridPositions.has(key)) {
            // Position conflict! Add to no-position list instead
            console.log(`Card ${setNumber}.${order} conflicts with existing card at position ${key}, adding to no-position list`);
            cardsWithoutPosition.push({ order, data });
          } else {
            gridPositions.set(key, { order, data });
            console.log(`Card ${setNumber}.${order} placed at position ${key}`);
          }
        } else {
          // Position exists but has null values, treat as no position
          console.log(`Card ${setNumber}.${order} has invalid position, adding to no-position list`);
          cardsWithoutPosition.push({ order, data });
        }
      } else if (data) {
        console.log(`Card ${setNumber}.${order} has no position, adding to no-position list`);
        cardsWithoutPosition.push({ order, data });
      } else {
        console.log(`Card ${setNumber}.${order} has no data, skipping`);
      }
    });
    
    // Second pass: fill empty positions with cards that don't have positions
    console.log(`Cards without position: ${cardsWithoutPosition.length}`, cardsWithoutPosition.map(c => `${setNumber}.${c.order}`));
    let cardWithoutPosIndex = 0;
    for (let row = 1; row <= 5; row++) {
      for (let col = 1; col <= 3; col++) {
        const key = `${row}-${col}`;
        if (!gridPositions.has(key) && cardWithoutPosIndex < cardsWithoutPosition.length) {
          const cardToPlace = cardsWithoutPosition[cardWithoutPosIndex];
          gridPositions.set(key, cardToPlace);
          console.log(`Placed card ${setNumber}.${cardToPlace.order} at empty position ${key}`);
          
          // Track cards that need position updates
          cardsToFix.push({
            order: cardToPlace.order,
            data: cardToPlace.data,
            newPosition: { row, col }
          });
          
          cardWithoutPosIndex++;
        }
      }
    }
    
    // Create grid in order (row by row, col by col)
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
        // Order number label
        const orderLabel = document.createElement('div');
        orderLabel.className = 'card-order';
        orderLabel.textContent = order;
        cardWrapper.appendChild(orderLabel);
        
        // Add click event to show individual card
        cardWrapper.addEventListener('click', () => {
          showIndividualCard(setNumber, order, cardData);
        });
        
        // Add edit button
        const editButton = document.createElement('button');
        editButton.className = 'card-edit-button';
        editButton.innerHTML = '✏️';
        editButton.title = 'Edit Card';
        editButton.addEventListener('click', (e) => {
          e.stopPropagation();
          openCardEditor(setNumber, order, cardData);
        });
        cardWrapper.appendChild(editButton);
        
        // SVG container
        const svgContainer = document.createElement('div');
        svgContainer.className = 'svg-container';
        cardWrapper.appendChild(svgContainer);
        
        // Load SVG if present
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
            const cardColor = getCardColor(cardData);
            const textColor = calculateSvgTextColor(cardColor, false);
            const useNaturalColors = cardData.options && cardData.options.svgColor === true;
            const cleanedSvg = stripSvgColors(svgContent, useNaturalColors);
            
            svgContainer.innerHTML = `
              <style>
                .svg-container ${createSvgStyle(false, '1', textColor, useNaturalColors)}
              </style>
              ${cleanedSvg}
            `;
            
            // Force a reflow/repaint to ensure SVG is rendered (from wfo.html)
            svgContainer.offsetHeight;
          }
        }
        
        // Canvas
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 848; // 600 * √2 = 600 * 1.41421356 = 848.528
        cardWrapper.appendChild(canvas);
        
        // Set background
        const bgColor = getCardColor(cardData);
        canvas.style.background = generateGradientFromColor(bgColor);
        
        // Draw simple preview
        drawCardPreview(canvas, cardData);
      }
      } else {
        // Empty slot - make it a valid drop target
        cardWrapper.classList.add('empty-slot');
        
        // Add a placeholder div to ensure events are captured
        const placeholder = document.createElement('div');
        placeholder.style.width = '100%';
        placeholder.style.height = '100%';
        placeholder.style.pointerEvents = 'none'; // Don't interfere with drag events
        cardWrapper.appendChild(placeholder);
      }
      
      gridEl.appendChild(cardWrapper);
      }
    }
    
    statusEl.style.display = 'none';
    gridEl.style.display = 'grid';
    
    // Fix position conflicts by updating card data files
    if (cardsToFix.length > 0) {
      console.log(`Fixing position conflicts for ${cardsToFix.length} cards:`, cardsToFix.map(c => `${setNumber}.${c.order} -> ${c.newPosition.row}-${c.newPosition.col}`));
      fixCardPositions(setNumber, cardsToFix);
    }
    
    // Setup drag and drop
    setupDragAndDrop(setNumber);
    
    // Update navigation area states
    updateNavigationAreas();
    
  } catch (error) {
    statusEl.style.display = 'none';
    console.error('Error displaying set:', error);
  }
}

// ===== CARD EDITOR FUNCTIONS =====
let currentEditingCard = null;

function toggleAccordion(header) {
  const accordion = header.parentElement;
  accordion.classList.toggle('collapsed');
}

function openCardEditor(setNumber, order, cardData) {
  currentEditingCard = { setNumber, order, cardData };
  
  // Populate editor fields
  document.getElementById('editorOrder').value = order || '';
  document.getElementById('editorSize').value = cardData.options?.size || 5;
  document.getElementById('editorSizeValue').textContent = cardData.options?.size || 5;
  document.getElementById('editorBackground').value = cardData.options?.backgroundColor || 'transparent';
  document.getElementById('editorItalics').checked = cardData.options?.italics !== false;
  document.getElementById('editorSvgColor').checked = cardData.options?.svgColor === true;
  document.getElementById('editorSvg').value = cardData.options?.svgBackground || '';
  document.getElementById('editorRule').value = cardData.rule || '';
  document.getElementById('editorInput').value = cardData.input || '';
  
  // Update position display
  const positionDisplay = document.getElementById('editorPositionDisplay');
  if (cardData.options?.position) {
    positionDisplay.textContent = `Row ${cardData.options.position.row}, Col ${cardData.options.position.col}`;
  } else {
    positionDisplay.textContent = 'Not set';
  }
  
  // Show modal
  document.getElementById('cardEditorModal').style.display = 'flex';
  
  // Update preview
  updateEditorPreview();
}

function closeCardEditor() {
  document.getElementById('cardEditorModal').style.display = 'none';
  currentEditingCard = null;
}

function updateEditorPreview() {
  // This would implement the card rendering logic
  // For now, just a placeholder
  const canvas = document.getElementById('editorCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Set background
  const bgColor = document.getElementById('editorBackground').value;
  if (bgColor === 'transparent') {
    ctx.fillStyle = '#f0f0f0';
  } else {
    ctx.fillStyle = bgColor;
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw placeholder text
  ctx.fillStyle = '#666';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Card Preview', canvas.width / 2, canvas.height / 2);
}

async function saveCard() {
  if (!currentEditingCard) return;
  
  try {
    const { setNumber, order } = currentEditingCard;
    
    // Get form values
    const newOrder = document.getElementById('editorOrder').value;
    const size = parseInt(document.getElementById('editorSize').value);
    const backgroundColor = document.getElementById('editorBackground').value;
    const italics = document.getElementById('editorItalics').checked;
    const svgColor = document.getElementById('editorSvgColor').checked;
    const svgBackground = document.getElementById('editorSvg').value;
    const rule = document.getElementById('editorRule').value;
    const input = document.getElementById('editorInput').value;
    
    // Update card data
    const cardDataObj = currentEditingCard.cardData;
    cardDataObj.rule = rule;
    cardDataObj.input = input;
    
    if (!cardDataObj.options) cardDataObj.options = {};
    cardDataObj.options.size = size;
    cardDataObj.options.backgroundColor = backgroundColor;
    cardDataObj.options.italics = italics;
    cardDataObj.options.svgColor = svgColor;
    if (svgBackground) {
      cardDataObj.options.svgBackground = svgBackground;
    }
    
    // Save to storage
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
    
    // Update cache
    const key = `${setNumber}.${order}`;
    cardData.set(key, cardDataObj);
    
    // Refresh display
    await displaySet(currentSetNumber);
    
    // Close editor
    closeCardEditor();
    
    console.log(`Card ${setNumber}.${order} saved successfully`);
    
  } catch (error) {
    console.error('Error saving card:', error);
  }
}

// ===== DELETE MODAL FUNCTIONS =====
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
    
    // Delete from Supabase storage
    const fileName = formatCardFilename(set, order);
    const { error } = await supabaseClient.storage
      .from('card')
      .remove([fileName]);
    
    if (error) {
      console.error(`Failed to delete card ${set}.${order}:`, error);
      return;
    }
    
    // Remove from cache
    const key = `${set}.${order}`;
    cardData.delete(key);
    
    // Remove from DOM
    if (cardToDelete.element) {
      cardToDelete.element.remove();
    }
    
    // Rescan sets to update setInfo
    await scanAllSets();
    
    // Check if the current set is now empty or no longer exists
    const currentSetInfo = setInfo.get(currentSetNumber);
    const isSetEmpty = !currentSetInfo || currentSetInfo.cardCount === 0;
    const isSetRemoved = !availableSets.includes(currentSetNumber);
    const isLastSet = currentSetNumber === Math.max(...availableSets);
    
    console.log('Delete check:', {
      currentSetNumber,
      availableSets,
      currentSetInfo,
      isSetEmpty,
      isSetRemoved,
      isLastSet,
      availableSetsLength: availableSets.length
    });
    
    if ((isSetEmpty || isSetRemoved) && availableSets.length > 0) {
      // Move to the last available set (which is now the new last set)
      const newCurrentSet = Math.max(...availableSets);
      console.log(`Set ${currentSetNumber} is now empty/removed, moving to set ${newCurrentSet}`);
      const oldSetNumber = currentSetNumber;
      currentSetNumber = newCurrentSet;
      console.log(`About to call displaySet(${currentSetNumber})`);
      await displaySet(currentSetNumber);
      console.log(`Successfully moved from set ${oldSetNumber} to set ${currentSetNumber}`);
    } else {
      console.log('Not moving - conditions not met:', { isSetEmpty, isSetRemoved, availableSetsLength: availableSets.length });
      // Refresh the current set display (middle sets can be empty)
      await displaySet(currentSetNumber);
    }
    
    console.log(`Card ${set}.${order} deleted successfully`);
    
  } catch (error) {
    console.error('Error deleting card:', error);
  } finally {
    hideDeleteModal();
  }
}

async function copyCard() {
  console.log('copyCard function called, cardToCopy:', cardToCopy);
  if (!cardToCopy) {
    console.log('No card to copy, returning');
    return;
  }
  
  try {
    const { set, order } = cardToCopy;
    
    // Load the original card data
    const key = `${set}.${order}`;
    let originalCardData = cardData.get(key);
    
    if (!originalCardData) {
      originalCardData = await loadCardData(set, order);
      if (!originalCardData) {
        console.error(`Failed to load card ${set}.${order} for copying`);
        return;
      }
    }
    
    // Create a copy of the card data
    const copiedCardData = JSON.parse(JSON.stringify(originalCardData));
    
    // Remove position so the copy gets placed in the next available slot
    if (copiedCardData.options) {
      copiedCardData.options.position = null;
    }
    
    // Find next available order number in current set
    const currentSetInfo = setInfo.get(currentSetNumber);
    let targetSet = currentSetNumber;
    let nextOrder = 1;
    
    if (currentSetInfo) {
      const usedOrders = currentSetInfo.cards.map(c => c.order);
      while (usedOrders.includes(nextOrder)) {
        nextOrder++;
      }
      
      // Check if current set is full (15 cards max)
      if (nextOrder > 15) {
        console.log(`Set ${currentSetNumber} is full (15 cards), looking for next available set`);
        
        // Find next available set or create new one
        const availableSets = Array.from(setInfo.keys()).sort((a, b) => a - b);
        let foundSet = null;
        
        // Look for a set with available space
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
          console.log(`Found available space in set ${targetSet}, order ${nextOrder}`);
        } else {
          // Create new set
          targetSet = Math.max(...availableSets) + 1;
          nextOrder = 1;
          console.log(`Creating new set ${targetSet}, order ${nextOrder}`);
        }
      }
    }
    
    console.log(`Copying card to position ${targetSet}.${nextOrder}`);
    
    // Save the copied card
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
    
    console.log(`Successfully saved copied card to storage`);
    
    // Update caches
    cardData.set(`${targetSet}.${nextOrder}`, copiedCardData);
    console.log(`Updated card data cache with new card`);
    
    // Rescan sets to update setInfo
    await scanAllSets();
    console.log(`Rescanned all sets`);
    
    // If we copied to a different set, switch to that set
    if (targetSet !== currentSetNumber) {
      currentSetNumber = targetSet;
      console.log(`Switched to set ${currentSetNumber}`);
    }
    
    // Refresh the current set display
    await displaySet(currentSetNumber);
    console.log(`Refreshed display for set ${currentSetNumber}`);
    
    console.log(`Card ${set}.${order} copied to ${targetSet}.${nextOrder} successfully`);
    
  } catch (error) {
    console.error('Error copying card:', error);
  } finally {
    cardToCopy = null;
  }
}

// ===== CARD MANAGEMENT FUNCTIONS =====
async function moveCardToSet(fromSet, cardOrder, toSet) {
  try {
    // Load the card data
    const key = `${fromSet}.${cardOrder}`;
    let cardDataObj = cardData.get(key);
    
    if (!cardDataObj) {
      cardDataObj = await loadCardData(fromSet, cardOrder);
      if (!cardDataObj) return;
    }
    
    // Find next available order number in target set
    const targetSetInfo = setInfo.get(toSet);
    let nextOrder = 1;
    if (targetSetInfo) {
      const usedOrders = targetSetInfo.cards.map(c => c.order);
      while (usedOrders.includes(nextOrder)) {
        nextOrder++;
      }
    }
    
    // Delete old file
    const oldFileName = formatCardFilename(fromSet, cardOrder);
    await supabaseClient.storage.from('card').remove([oldFileName]);
    
    // Reset position for new set
    if (cardDataObj.options) {
      cardDataObj.options.position = null;
    }
    
    // Save to new location
    const newFileName = formatCardFilename(toSet, nextOrder);
    const jsonString = JSON.stringify(cardDataObj, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    await supabaseClient.storage
      .from('card')
      .upload(newFileName, blob, { contentType: 'application/json', upsert: true });
    
    // Update caches
    cardData.delete(key);
    cardData.set(`${toSet}.${nextOrder}`, cardDataObj);
    
    // Rescan sets to update setInfo
    await scanAllSets();
    
    // Switch to the target set and display
    currentSetNumber = toSet;
    await displaySet(toSet);
    
    // Ensure buttons are hidden after set change
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

// ===== NAVIGATION FUNCTIONS =====
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
  return null; // All sets are full
}

// ===== INITIALIZATION AND EVENT HANDLERS =====
document.getElementById('nextSetArea').addEventListener('click', goToNextSet);
document.getElementById('prevSetArea').addEventListener('click', goToPreviousSet);

// Click on individual card to close it
document.getElementById('individualCard').addEventListener('click', hideIndividualCard);

// Delete modal event handlers
document.getElementById('confirmDelete').addEventListener('click', deleteCard);
document.getElementById('cancelDelete').addEventListener('click', hideDeleteModal);

// Card editor event handlers
document.getElementById('cancelEdit').addEventListener('click', closeCardEditor);
document.getElementById('saveCard').addEventListener('click', saveCard);

// Editor form event handlers
document.getElementById('editorSize').addEventListener('input', (e) => {
  document.getElementById('editorSizeValue').textContent = e.target.value;
  updateEditorPreview();
});

document.getElementById('editorBackground').addEventListener('change', updateEditorPreview);
document.getElementById('editorItalics').addEventListener('change', updateEditorPreview);
document.getElementById('editorSvgColor').addEventListener('change', updateEditorPreview);
document.getElementById('editorSvg').addEventListener('input', updateEditorPreview);
document.getElementById('editorRule').addEventListener('input', updateEditorPreview);
document.getElementById('editorInput').addEventListener('input', updateEditorPreview);

// Also close on Escape key
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
});

// Initialize: scan all sets and load first one
async function initialize() {
  await scanAllSets();
  
  // Load the first available set
  if (availableSets.length > 0) {
    currentSetNumber = availableSets[0];
    displaySet(currentSetNumber);
  }
}

// Start the app
initialize();
