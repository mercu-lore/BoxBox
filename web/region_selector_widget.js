/**
 * Region Selector Widget - Integrazione con ComfyUI
 * Aggiunge un bottone al nodo per aprire il selettore di regioni
 */

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "ImageRegionSelect.RegionSelector",

    /**
     * Quando un nodo viene creato, aggiungi il widget personalizzato
     */
    async nodeCreated(node, app) {
        // Esegui solo per il nodo RegionSelectorNode
        if (node.comfyClass !== "RegionSelectorNode") return;

        // Trova i widget del nodo
        const widthWidget = node.widgets.find(w => w.name === "image_width");
        const heightWidget = node.widgets.find(w => w.name === "image_height");
        const coordinatesWidget = node.widgets.find(w => w.name === "coordinates_json");

        // Crea bottone per aprire il selettore
        const selectorButton = document.createElement("button");
        selectorButton.textContent = "🎯 Apri Selettore Regioni";
        selectorButton.style.cssText = `
            width: 100%;
            padding: 10px;
            margin: 5px 0;
            background-color: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        `;

        selectorButton.addEventListener("mouseover", () => {
            selectorButton.style.backgroundColor = "#1d4ed8";
        });

        selectorButton.addEventListener("mouseout", () => {
            selectorButton.style.backgroundColor = "#2563eb";
        });

        selectorButton.addEventListener("click", () => {
            openRegionSelector(node, widthWidget, heightWidget, coordinatesWidget);
        });

        // Aggiungi il bottone al nodo
        const container = document.createElement("div");
        container.style.marginBottom = "10px";
        container.appendChild(selectorButton);

        // Inserisci prima del primo widget
        if (node.widgets.length > 0) {
            node.widgets[0].element?.parentNode?.insertBefore(container, node.widgets[0].element);
        }

        // Aggiungi anche come custom widget per miglior tracking
        node.regionSelectorButton = selectorButton;
        node.regionSelectorContainer = container;

        // Aggiungi etichetta informativa
        const infoLabel = document.createElement("div");
        infoLabel.style.cssText = `
            font-size: 11px;
            color: #64748b;
            padding: 5px 0;
            margin: 5px 0;
            text-align: center;
        `;
        infoLabel.textContent = "Apri l'interfaccia per selezionare le coordinate della regione";
        container.appendChild(infoLabel);
    },

    /**
     * Hook che si chiama quando il nodo viene caricato
     */
    async loadedGraphNode(node, app) {
        if (node.comfyClass !== "RegionSelectorNode") return;

        // Ripristina lo stato del bottone se necessario
        const coordinatesWidget = node.widgets.find(w => w.name === "coordinates_json");
        if (coordinatesWidget && coordinatesWidget.value && coordinatesWidget.value !== "{}") {
            console.log("Region coordinates loaded:", coordinatesWidget.value);
        }
    }
});

/**
 * Apre l'interfaccia selettore di regioni
 */
function openRegionSelector(node, widthWidget, heightWidget, coordinatesWidget) {
    // Carica l'HTML dell'interfaccia
    const htmlPath = "extensions/ImageRegionSelect/region_selector.html";

    fetch(htmlPath)
        .then(response => {
            if (!response.ok) throw new Error(`Failed to load ${htmlPath}`);
            return response.text();
        })
        .then(html => {
            // Crea una finestra modale
            const modal = createModal(html, node, widthWidget, heightWidget, coordinatesWidget);
            document.body.appendChild(modal);
        })
        .catch(error => {
            console.error("Error loading region selector:", error);
            alert("Errore nel caricamento del selettore di regioni: " + error.message);
        });
}

/**
 * Crea una finestra modale con il selettore
 */
function createModal(html, node, widthWidget, heightWidget, coordinatesWidget) {
    const modal = document.createElement("div");
    modal.id = "region-selector-modal";
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(2px);
    `;

    // Container principale
    const container = document.createElement("div");
    container.style.cssText = `
        width: 90vw;
        height: 90vh;
        background-color: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    `;

    // Inserisci l'HTML del selettore
    container.innerHTML = html;

    modal.appendChild(container);

    // Attendi che il DOM sia pronto
    setTimeout(() => {
        // Inizializza il selettore con i callback
        if (window.RegionSelector) {
            window.RegionSelector.init(
                (coordinates) => handleCoordinatesConfirmed(coordinates, modal, coordinatesWidget, node),
                () => handleSelectorCancel(modal)
            );

            // Carica coordinate precedenti se esistono
            if (coordinatesWidget && coordinatesWidget.value && coordinatesWidget.value !== "{}") {
                try {
                    const previousCoordinates = JSON.parse(coordinatesWidget.value);
                    if (previousCoordinates.x !== undefined) {
                        window.RegionSelector.loadCoordinates(previousCoordinates);
                    }
                } catch (e) {
                    console.warn("Could not load previous coordinates:", e);
                }
            }
        }

        // Aggiorna i bottoni di chiusura
        const closeBtn = document.getElementById("close-btn");
        const cancelBtn = document.getElementById("cancel-btn");

        if (closeBtn) {
            closeBtn.addEventListener("click", () => handleSelectorCancel(modal));
        }
        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => handleSelectorCancel(modal));
        }

        // Precarica l'immagine di sfondo (opzionale)
        loadBackgroundImage(node, widthWidget, heightWidget);

    }, 50);

    return modal;
}

/**
 * Gestisce la conferma delle coordinate
 */
function handleCoordinatesConfirmed(coordinates, modal, coordinatesWidget, node) {
    // Salva le coordinate nel widget JSON
    coordinatesWidget.value = JSON.stringify(coordinates);

    // Forza l'aggiornamento del nodo
    if (node.widgets) {
        // Trigga callback se esiste
        if (coordinatesWidget.callback) {
            coordinatesWidget.callback(coordinatesWidget.value);
        }
    }

    // Log per debug
    console.log("Region coordinates confirmed and saved:", coordinates);

    // Mostra messaggio di successo
    showNotification("✅ Selezione confermata!", "success");

    // Chiudi la modale
    modal.remove();
}

/**
 * Gestisce l'annullamento
 */
function handleSelectorCancel(modal) {
    modal.remove();
    console.log("Region selector cancelled");
}

/**
 * Carica un'immagine come sfondo nell'interfaccia
 * Ridimensiona automaticamente se > 1024px
 */
async function loadBackgroundImage(node, widthWidget, heightWidget) {
    try {
        const bgImg = document.getElementById("background-image");
        if (!bgImg) {
            console.warn("background-image element not found");
            return;
        }

        // Cerca il widget immagine del nodo
        const imageWidget = node.widgets.find(w => w.type === "image" || w.name === "image");
        if (!imageWidget || !imageWidget.value) {
            console.warn("No image widget found on node");
            return;
        }

        // Estrai il filename dall'immagine
        let filename = imageWidget.value;
        if (typeof filename === "object" && filename.name) {
            filename = filename.name;
        }

        console.log(`[RegionSelector] Caricamento immagine: ${filename}`);

        // Chiama l'endpoint per scalare se necessario
        const scaleResponse = await fetch("/region_selector/scale", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: filename })
        });

        const scaleResult = await scaleResponse.json();
        console.log(`[RegionSelector] Scale result:`, scaleResult);

        if (scaleResult.path) {
            // Carica l'immagine (originale o scalata) nel Region Selector
            bgImg.src = scaleResult.path;

            // Salva i dati per il calcolo delle coordinate
            if (scaleResult.scaled) {
                bgImg.dataset.scaled = "true";
                bgImg.dataset.scaleFactor = scaleResult.scale || 1;
                console.log(`[RegionSelector] Immagine scalata caricata, scale factor: ${scaleResult.scale}`);
            } else {
                bgImg.dataset.scaled = "false";
                bgImg.dataset.scaleFactor = 1;
                console.log(`[RegionSelector] Immagine originale caricata (≤ 1024px)`);
            }
        } else if (scaleResult.error) {
            console.warn(`[RegionSelector] Scale error: ${scaleResult.error}`);
        }
    } catch (e) {
        console.warn("Could not auto-load image:", e);
    }
}

/**
 * Mostra una notifica temporanea
 */
function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        z-index: 20000;
        animation: slideIn 0.3s ease;
        ${type === "success" ? "background-color: #16a34a; color: white;" :
          type === "error" ? "background-color: #dc2626; color: white;" :
          "background-color: #2563eb; color: white;"}
    `;

    document.body.appendChild(notification);

    // Auto-remove dopo 3 secondi
    setTimeout(() => {
        notification.style.animation = "slideOut 0.3s ease";
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Aggiungi animazioni CSS
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
