// Card operations module

// Base color utility functions
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

// Color utility functions
function generateGradientFromColor(hexColor, secondColor = null) {
  if (hexColor === 'transparent') {
    return 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)';
  }
  
  if (secondColor && secondColor !== '' && secondColor !== 'transparent') {
    return `linear-gradient(90deg, ${hexColor} 0%, ${secondColor} 100%)`;
  }
  
  const rgb = hexToRgb(hexColor);
  const lighter = `rgb(${Math.min(255, rgb.r + 40)}, ${Math.min(255, rgb.g + 40)}, ${Math.min(255, rgb.b + 40)})`;
  const darker = `rgb(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)})`;
  return `linear-gradient(135deg, ${lighter} 0%, ${hexColor} 50%, ${darker} 100%)`;
}

function getCardColors(cardData) {
  const primaryColor = (cardData && cardData.options && cardData.options.backgroundColor) || '#808080';
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

function calculateSvgTextColor(backgroundColor, editorVisible) {
  if (backgroundColor === 'transparent') {
    return editorVisible ? '#000000' : '#ffffff';
  }
  const rgb = hexToRgb(backgroundColor);
  const luminosity = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminosity > 0.5 ? '#000000' : '#ffffff';
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
  
  // Draw card preview if drawing module is available
  if (typeof drawCardPreview === 'function') {
    drawCardPreview(canvas, cardData, true);  // true = individual view
  }
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
        // Draw card preview if drawing module is available
        if (typeof drawCardPreview === 'function') {
          drawCardPreview(canvas, cardData);
        }
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
