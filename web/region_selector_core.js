/**
 * Region Selector JavaScript – versione finale
 * Gestione immagini grandi, salvataggio /temp, coordinate in scala corretta
 */

const container = document.getElementById('canvas-container');
const backgroundImage = document.getElementById('background-image');
const confirmBtn = document.getElementById('confirm-btn');
const cancelBtn = document.getElementById('cancel-btn');
const closeBtn = document.getElementById('close-btn');
const uploadBtn = document.getElementById('upload-btn');
const imageUpload = document.getElementById('image-upload');
const imageName = document.getElementById('image-name');

let isDrawing = false;
let currentRectangle = null;
let baseX = 0, baseY = 0, baseWidth = 0, baseHeight = 0;
let imageScale = 1;
let onConfirmCallback = null;
let onCancelCallback = null;
let rectangleExists = false;

// Aspect Ratio Mode
let aspectRatioMode = "free";        // "free" o ratio specifico (es. "16:9")
let aspectRatioValue = null;         // Valore numerico (es. 16/9 = 1.777)

// Fix Image Size - tracking dello stato
let displayScaleFactor = 1.0;  // Fattore di scala applicato alla preview
let isImageFixed = false;       // True quando immagine è stata "fixata"

// ============================================================================
// INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  uploadBtn.addEventListener('click', () => imageUpload.click());
  imageUpload.addEventListener('change', handleImageUpload);
  container.addEventListener('mousedown', handleCanvasMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', () => {
    isDrawing = false;
    if (rectangleExists) {
      updateDimensionsDisplay();
    }
  });
  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
  closeBtn.addEventListener('click', handleCancel);
  backgroundImage.addEventListener('dragstart', e => e.preventDefault());

  // Aspect Ratio Mode Selector
  const aspectRatioSelect = document.getElementById('aspect-ratio-select');
  const aspectRatioHint = document.getElementById('aspect-ratio-hint');

  if (aspectRatioSelect) {
    aspectRatioSelect.addEventListener('change', (e) => {
      aspectRatioMode = e.target.value;

      // Calcola valore numerico
      const ratioMap = {
        "free": null,
        "1:1": 1/1,
        "3:4": 3/4,
        "5:8": 5/8,
        "9:16": 9/16,
        "9:21": 9/21,
        "4:3": 4/3,
        "3:2": 3/2,
        "16:9": 16/9,
        "21:9": 21/9,
      };

      aspectRatioValue = ratioMap[aspectRatioMode];

      // Aggiorna hint
      if (aspectRatioMode === "free") {
        aspectRatioHint.textContent = "Disegno libero - il ratio verrà calcolato";
        aspectRatioHint.style.color = "#64748b";
        aspectRatioHint.style.fontWeight = "normal";
      } else {
        aspectRatioHint.textContent = `Rettangolo vincolato a ${aspectRatioMode}`;
        aspectRatioHint.style.color = "#16a34a";
        aspectRatioHint.style.fontWeight = "600";
      }

      console.log(`[AspectRatio] Mode: ${aspectRatioMode}, Value: ${aspectRatioValue}`);

      // Se c'è già un rettangolo e passi a modalità vincolata, adattalo
      if (rectangleExists && aspectRatioValue !== null) {
        adjustRectangleToAspectRatio();
      }
    });
  }

  // 🔹 Gestione immagini caricate da ComfyUI (backend scala se necessario)
  backgroundImage.addEventListener("load", () => {
    const naturalW = backgroundImage.naturalWidth;
    const naturalH = backgroundImage.naturalHeight;

    console.log(`[RegionSelector] Image loaded: ${naturalW}x${naturalH}`);

    // Usa i dati salvati da loadBackgroundImage() se disponibili
    const scaled = backgroundImage.dataset.scaled === "true";
    const scaleFactor = parseFloat(backgroundImage.dataset.scaleFactor || "1");

    if (scaled) {
      console.log(`[RegionSelector] Loaded scaled image with scale factor: ${scaleFactor}`);
    } else {
      console.log(`[RegionSelector] Loaded original image (≤ 1024px)`);
    }

    // Salva i metadati
    backgroundImage.dataset.originalScale = scaleFactor;

    // 🆕 Crea bottone Fix Image Size se immagine è più grande di 1024
    const maxDim = Math.max(naturalW, naturalH);
    console.log(`[FixImage] maxDim = ${maxDim}, condition (>1024) = ${maxDim > 1024}`);

    if (maxDim > 1024) {
      console.log('[FixImage] Image is large, creating button...');
      if (!document.getElementById('fix-image-btn')) {
        createFixImageButton();
        showAutoFixSuggestion(maxDim);
      } else {
        console.log('[FixImage] Button already exists, skipping creation');
      }
    } else {
      console.log('[FixImage] Image is small, no button needed');
    }

    setTimeout(updateImageScale, 150);
  });
});

// ============================================================================
// FILE UPLOAD MANUALE
// ============================================================================
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    backgroundImage.src = event.target.result;
    imageName.textContent = `Immagine corrente: ${file.name}`;

    backgroundImage.onload = () => {
      backgroundImage.dataset.originalWidth = backgroundImage.naturalWidth;
      backgroundImage.dataset.originalHeight = backgroundImage.naturalHeight;
      backgroundImage.dataset.originalScale = 1;
      setTimeout(updateImageScale, 150);
    };
  };
  reader.readAsDataURL(file);
}

// ============================================================================
// UPDATE SCALE
// ============================================================================
function updateImageScale() {
  if (!backgroundImage) return;
  const nW = backgroundImage.naturalWidth;
  const dW = backgroundImage.clientWidth || backgroundImage.width;
  if (!nW || !dW) return;
  imageScale = nW / dW;
  console.log(`[RegionSelector] imageScale=${imageScale.toFixed(3)}`);
}

// ============================================================================
// ADJUST RECTANGLE TO ASPECT RATIO
// ============================================================================
function adjustRectangleToAspectRatio() {
  if (!aspectRatioValue || !rectangleExists) return;

  // Mantieni larghezza, adatta altezza al ratio
  baseHeight = baseWidth / aspectRatioValue;

  // Aggiorna visualizzazione
  updateRectanglePosition(
    baseX / imageScale,
    baseY / imageScale,
    baseWidth / imageScale,
    baseHeight / imageScale
  );

  updateDimensionsDisplay();

  console.log(`[AspectRatio] Adjusted to ${aspectRatioMode}: ${Math.round(baseWidth)}x${Math.round(baseHeight)}`);
}

// ============================================================================
// RECTANGLE DRAWING
// ============================================================================
function handleCanvasMouseDown(e) {
  if (e.button !== 0) return;
  const rect = backgroundImage.getBoundingClientRect();
  const imgX = e.clientX - rect.left;
  const imgY = e.clientY - rect.top;

  isDrawing = true;
  baseX = imgX * imageScale;  // USA imageScale per ottenere coordinate reali
  baseY = imgY * imageScale;
  baseWidth = 1;
  baseHeight = 1;
  createNewRectangle(imgX, imgY, 1, 1);

  // Resetta le info
  updateDimensionsDisplay();
}

function handleMouseMove(e) {
  if (!isDrawing) return;
  const rect = backgroundImage.getBoundingClientRect();
  const imgX = e.clientX - rect.left;
  const imgY = e.clientY - rect.top;

  const realX = imgX * imageScale;
  const realY = imgY * imageScale;

  // Calcola dimensioni base
  let newWidth = Math.abs(realX - baseX);
  let newHeight = Math.abs(realY - baseY);

  // ⚙️ APPLICA VINCOLO SE NECESSARIO
  if (aspectRatioValue !== null) {
    // Modalità vincolata: forza l'aspect ratio
    // Mantieni la dimensione maggiore e adatta l'altra
    if (newWidth / aspectRatioValue > newHeight) {
      newHeight = newWidth / aspectRatioValue;
    } else {
      newWidth = newHeight * aspectRatioValue;
    }
  }
  // Altrimenti modalità "free": usa dimensioni naturali

  baseWidth = newWidth;
  baseHeight = newHeight;

  const x = Math.min(baseX, realX);
  const y = Math.min(baseY, realY);

  // Aggiorna visualizzazione
  updateRectanglePosition(x / imageScale, y / imageScale, baseWidth / imageScale, baseHeight / imageScale);

  // Aggiorna info
  updateDimensionsDisplay();

  // Abilita conferma
  if (baseWidth > 10 && baseHeight > 10) {
    confirmBtn.disabled = false;
  }
}

function updateDimensionsDisplay() {
  const baseCoordinatesDiv = document.getElementById("base-coordinates");
  if (!baseCoordinatesDiv) {
    console.warn("[RegionSelector] base-coordinates div not found!");
    return;
  }

  if (!rectangleExists || baseWidth === 0 || baseHeight === 0) {
    baseCoordinatesDiv.innerHTML = `<p>Clicca e trascina sull'immagine per selezionare una regione</p>`;
    return;
  }

  const w = Math.round(baseWidth);
  const h = Math.round(baseHeight);
  const ratio = w / h;

  // 🎯 MODALITÀ CUSTOM: Calcola approssimazione
  let aspectRatioDisplay;

  if (aspectRatioMode === "free") {
    // Lista aspect ratio standard
    const standardRatios = [
      { value: 21/9, label: "21:9 Landscape", display: "21:9" },
      { value: 16/9, label: "16:9 Landscape", display: "16:9" },
      { value: 3/2, label: "3:2 Landscape", display: "3:2" },
      { value: 4/3, label: "4:3 Landscape", display: "4:3" },
      { value: 1/1, label: "1:1 Square", display: "1:1" },
      { value: 3/4, label: "3:4 Portrait", display: "3:4" },
      { value: 5/8, label: "5:8 Portrait", display: "5:8" },
      { value: 9/16, label: "9:16 Portrait", display: "9:16" },
      { value: 9/21, label: "9:21 Portrait", display: "9:21" },
    ];

    // Trova il più vicino
    let closestRatio = standardRatios[0];
    let minDiff = Math.abs(ratio - standardRatios[0].value);

    for (const r of standardRatios) {
      const diff = Math.abs(ratio - r.value);
      if (diff < minDiff) {
        minDiff = diff;
        closestRatio = r;
      }
    }

    const diffPercent = (minDiff / ratio) * 100;

    // Formato display basato su vicinanza
    if (diffPercent < 3) {
      // Molto vicino - mostra come esatto
      aspectRatioDisplay = `<span style="color: #16a34a; font-weight: bold;">✓ ${closestRatio.label}</span>`;
    } else if (diffPercent < 8) {
      // Abbastanza vicino - mostra approssimato
      aspectRatioDisplay = `<span style="color: #ea580c; font-weight: bold;">~ ${closestRatio.label}</span> <span style="opacity: 0.6; font-size: 11px;">(${ratio.toFixed(2)}:1)</span>`;
    } else {
      // Troppo diverso - mostra custom + più vicino
      aspectRatioDisplay = `<span style="color: #2563eb; font-weight: bold;">${ratio.toFixed(2)}:1</span> <span style="opacity: 0.5; font-size: 11px;">(vicino: ${closestRatio.display})</span>`;
    }
  } else {
    // 🔒 MODALITÀ VINCOLATA: Mostra il vincolo attivo
    aspectRatioDisplay = `<span style="color: #16a34a; font-weight: bold;">🔒 ${aspectRatioMode}</span> <span style="opacity: 0.6; font-size: 11px;">(${ratio.toFixed(2)}:1)</span>`;
  }

  // Aggiorna HTML
  baseCoordinatesDiv.innerHTML = `
    <p><strong>X:</strong> ${Math.round(baseX)} px</p>
    <p><strong>Y:</strong> ${Math.round(baseY)} px</p>
    <p><strong>Larghezza:</strong> ${w} px</p>
    <p><strong>Altezza:</strong> ${h} px</p>
    <p><strong>Aspect Ratio:</strong> ${aspectRatioDisplay}</p>
  `;
}

function createNewRectangle(x, y, width, height) {
  if (currentRectangle) currentRectangle.remove();
  const rect = document.createElement("div");
  rect.className = "rectangle border-inside";
  rect.style.left = `${x}px`;
  rect.style.top = `${y}px`;
  rect.style.width = `${width}px`;
  rect.style.height = `${height}px`;
  container.appendChild(rect);
  currentRectangle = rect;
  rectangleExists = true;
}

function updateRectanglePosition(x, y, width, height) {
  if (!currentRectangle) return;
  currentRectangle.style.left = `${x}px`;
  currentRectangle.style.top = `${y}px`;
  currentRectangle.style.width = `${width}px`;
  currentRectangle.style.height = `${height}px`;
}

// ============================================================================
// EXPORT COORDINATES
// ============================================================================
function getCoordinates() {
  if (!rectangleExists) return {};

  // Leggi il fattore di scala salvato da loadBackgroundImage()
  const scaleFactor = parseFloat(backgroundImage.dataset.originalScale || "1");

  // Le coordinate baseX, baseY, baseWidth, baseHeight sono relative all'immagine visualizzata
  // Se l'immagine è stata scalata dal backend, devi applicare il fattore di scala inverso
  // Per ottenere le coordinate dell'immagine ORIGINALE (prima del scaling)

  const coords = {
    x: Math.round(baseX / scaleFactor),              // Dividi per scale factor
    y: Math.round(baseY / scaleFactor),
    width: Math.round(baseWidth / scaleFactor),
    height: Math.round(baseHeight / scaleFactor),
    imageScale: imageScale,
    scaleFactor: scaleFactor,                         // Salva il fattore di scala per riferimento
    displayedWidth: backgroundImage.clientWidth,
    displayedHeight: backgroundImage.clientHeight,
    naturalWidth: backgroundImage.naturalWidth,
    naturalHeight: backgroundImage.naturalHeight
  };

  console.log("[RegionSelector] Exporting coordinates:", coords);
  return coords;
}

// ============================================================================
// ACTION BUTTONS
// ============================================================================
function handleConfirm() {
  const coords = getCoordinates();
  if (onConfirmCallback) onConfirmCallback(coords);
  console.log("[RegionSelector] Coordinates confirmed");
}

function handleCancel() {
  if (onCancelCallback) onCancelCallback();
}

// ============================================================================
// FIX IMAGE SIZE - FUNZIONI
// ============================================================================

/**
 * Crea dinamicamente il bottone "Fix Image Size" nel panel di controllo.
 */
function createFixImageButton() {
  // Controlla se bottone esiste già
  if (document.getElementById('fix-image-btn')) {
    console.log('[FixImage] Button already exists');
    return;
  }

  // Trova dove mettere il bottone: dopo aspect ratio hint
  const aspectRatioHint = document.getElementById('aspect-ratio-hint');

  if (!aspectRatioHint) {
    console.error('[FixImage] Could not find aspect-ratio-hint');
    return;
  }

  // Crea il nuovo control group per il bottone
  const newControlGroup = document.createElement('div');
  newControlGroup.className = 'control-group';

  // Crea il bottone
  const fixImageBtn = document.createElement('button');
  fixImageBtn.id = 'fix-image-btn';
  fixImageBtn.className = 'btn btn-primary';
  fixImageBtn.textContent = '⚡ Fix Image Size';
  fixImageBtn.addEventListener('click', () => {
    console.log('[FixImage] Button clicked, isImageFixed =', isImageFixed);
    if (isImageFixed) {
      resetImageScale();
    } else {
      fixImageScale();
    }
  });

  // Crea la piccola descrizione
  const small = document.createElement('small');
  small.textContent = 'Ridimensiona preview per selezione fluida';

  // Aggiungi al control group
  newControlGroup.appendChild(fixImageBtn);
  newControlGroup.appendChild(small);

  // Inserisci dopo aspect ratio hint
  aspectRatioHint.parentNode.insertBefore(newControlGroup, aspectRatioHint.nextSibling);

  console.log('[FixImage] Button created dynamically');
}

/**
 * Ridimensiona la preview dell'immagine a max 1024px mantenendo aspect ratio.
 */
function fixImageScale() {
  const naturalW = backgroundImage.naturalWidth;
  const naturalH = backgroundImage.naturalHeight;
  const maxDim = 1024;

  const maxCurrent = Math.max(naturalW, naturalH);

  if (maxCurrent <= maxDim) {
    alert("✓ Immagine già piccola (max: " + maxCurrent + "px)!");
    return;
  }

  displayScaleFactor = maxDim / maxCurrent;

  const newW = Math.round(naturalW * displayScaleFactor);
  const newH = Math.round(naturalH * displayScaleFactor);

  console.log(`[FixImage] Scaling ${naturalW}x${naturalH} → ${newW}x${newH} (factor: ${displayScaleFactor.toFixed(3)})`);

  backgroundImage.style.width = `${newW}px`;
  backgroundImage.style.height = `${newH}px`;
  backgroundImage.style.maxWidth = 'none';
  backgroundImage.style.maxHeight = 'none';

  isImageFixed = true;
  const fixImageBtn = document.getElementById('fix-image-btn');
  if (fixImageBtn) {
    fixImageBtn.textContent = "🔄 Reset Scale";
    fixImageBtn.classList.remove('btn-primary');
    fixImageBtn.classList.add('btn-warning');
  }

  showScaleInfo(displayScaleFactor, newW, newH, naturalW, naturalH);

  const suggestion = document.getElementById('auto-fix-suggestion');
  if (suggestion) {
    suggestion.style.display = 'none';
  }

  setTimeout(() => {
    updateImageScale();
  }, 100);
}

/**
 * Resetta la visualizzazione dell'immagine alle dimensioni originali.
 */
function resetImageScale() {
  displayScaleFactor = 1.0;

  console.log("[FixImage] Resetting to original scale");

  backgroundImage.style.width = 'auto';
  backgroundImage.style.height = 'auto';
  backgroundImage.style.maxWidth = '100%';
  backgroundImage.style.maxHeight = '100%';

  isImageFixed = false;
  const fixImageBtn = document.getElementById('fix-image-btn');
  if (fixImageBtn) {
    fixImageBtn.textContent = "⚡ Fix Image Size";
    fixImageBtn.classList.remove('btn-warning');
    fixImageBtn.classList.add('btn-primary');
  }

  hideScaleInfo();

  setTimeout(() => {
    updateImageScale();
  }, 100);
}

/**
 * Mostra le informazioni sul fattore di scala applicato.
 */
function showScaleInfo(scale, displayW, displayH, originalW, originalH) {
  const infoDiv = document.getElementById('scale-info');
  if (!infoDiv) return;

  const scalePercent = (scale * 100).toFixed(1);

  infoDiv.innerHTML = `
    <p><strong>📊 Preview Scale:</strong> ${scalePercent}%</p>
    <p><strong>🖼️ Display Size:</strong> ${displayW} × ${displayH} px</p>
    <p><strong>📐 Original Size:</strong> ${originalW} × ${originalH} px</p>
    <p style="color: #16a34a; font-weight: 600; margin-top: 8px;">✓ Selezione fluida attiva</p>
    <p style="font-size: 10px; color: #64748b; margin-top: 5px;">Le coordinate saranno convertite automaticamente</p>
  `;
  infoDiv.style.display = 'block';
}

/**
 * Nasconde le informazioni sul fattore di scala.
 */
function hideScaleInfo() {
  const infoDiv = document.getElementById('scale-info');
  if (infoDiv) {
    infoDiv.style.display = 'none';
  }
}

/**
 * Mostra un suggerimento per fixare immagini molto grandi.
 */
function showAutoFixSuggestion(maxDimension) {
  const suggestion = document.getElementById('auto-fix-suggestion');
  if (!suggestion) return;

  const fixImageBtn = document.getElementById('fix-image-btn');

  suggestion.innerHTML = `
    <p style="color: #ea580c; font-weight: 600; margin-bottom: 5px;">
        ⚠️ Immagine molto grande (${maxDimension} px)
    </p>
    <p style="font-size: 11px; color: #64748b;">
        Per una selezione più fluida, clicca il bottone "Fix Image Size" qui sotto
    </p>
  `;
  suggestion.style.display = 'block';

  if (fixImageBtn) {
    fixImageBtn.classList.add('pulse-animation');

    setTimeout(() => {
      fixImageBtn.classList.remove('pulse-animation');
    }, 5000);
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================
window.RegionSelector = {
  init: (onConfirm, onCancel) => {
    onConfirmCallback = onConfirm;
    onCancelCallback = onCancel;
  },
  getCoordinates: () => getCoordinates()
};
