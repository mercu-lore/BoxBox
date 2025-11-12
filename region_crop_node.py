"""
Region Crop Node - Nodo che taglia l'immagine secondo le coordinate selezionate
"""

import json
import torch


class RegionCropNode:
    """
    Nodo che taglia un'immagine usando le coordinate fornite dal RegionSelectorNode.
    """

    def __init__(self):
        """Inizializza il nodo"""
        pass

    @classmethod
    def INPUT_TYPES(cls):
        """
        Definisce gli input del nodo.
        """
        return {
            "required": {
                "image": ("IMAGE",),
                "region_metadata": ("STRING", {
                    "default": "{}",
                    "multiline": True,
                }),
            },
            "optional": {
                "fallback_mode": (["use_full_image", "return_zero", "error"], {
                    "default": "use_full_image",
                }),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("cropped_image",)
    FUNCTION = "crop_image"
    CATEGORY = "image/region"

    def crop_image(self, image, region_metadata, fallback_mode="use_full_image"):
        """
        Taglia l'immagine secondo le coordinate nel metadata.

        Args:
            image: Tensor immagine (B, H, W, C)
            region_metadata: JSON string con coordinate della regione
            fallback_mode: Cosa fare se non ci sono coordinate valide

        Returns:
            (cropped_image,): Immagine ritagliata
        """

        try:
            metadata = json.loads(region_metadata)
        except json.JSONDecodeError:
            metadata = {}

        # Estrai coordinate (x1, x2, y1, y2 sono i lati)
        x1 = metadata.get("x1", None)
        x2 = metadata.get("x2", None)
        y1 = metadata.get("y1", None)
        y2 = metadata.get("y2", None)

        # Se non c'è selezione
        if x1 is None or x2 is None or y1 is None or y2 is None:
            if fallback_mode == "use_full_image":
                return (image,)
            elif fallback_mode == "return_zero":
                return (torch.zeros_like(image),)
            else:
                raise ValueError("No region coordinates provided in metadata")

        # Estrai il fattore di scala se la preview era stata scalata
        display_scale_factor = metadata.get("displayScaleFactor", 1.0)
        if display_scale_factor and display_scale_factor != 1.0:
            # Se le coordinate sono state prese da una preview scalata,
            # dividi per il fattore di scala per ottenere le coordinate originali
            x1 = x1 / display_scale_factor
            x2 = x2 / display_scale_factor
            y1 = y1 / display_scale_factor
            y2 = y2 / display_scale_factor
            print(f"[BoxCrop] Scale factor detected: {display_scale_factor}x. Adjusted coordinates.")

        # Assicura che le coordinate siano integer
        x1 = int(round(x1))
        x2 = int(round(x2))
        y1 = int(round(y1))
        y2 = int(round(y2))

        # Estrai dimensioni immagine
        batch_size, img_height, img_width, channels = image.shape

        # Assicura che x1 < x2 e y1 < y2
        x_start = min(x1, x2)
        x_end = max(x1, x2)
        y_start = min(y1, y2)
        y_end = max(y1, y2)

        # Calcola coordinate finali con clipping ai bordi
        x_start = max(0, min(x_start, img_width - 1))
        x_end = max(x_start + 1, min(x_end, img_width))
        y_start = max(0, min(y_start, img_height - 1))
        y_end = max(y_start + 1, min(y_end, img_height))

        # Verifica validità della region
        if x_end <= x_start or y_end <= y_start:
            if fallback_mode == "use_full_image":
                return (image,)
            elif fallback_mode == "return_zero":
                return (torch.zeros_like(image),)
            else:
                raise ValueError("Invalid region coordinates: no overlap with image")

        # Taglia l'immagine
        cropped = image[:, y_start:y_end, x_start:x_end, :]

        return (cropped,)


NODE_CLASS_MAPPINGS = {"BoxCrop": RegionCropNode}
NODE_DISPLAY_NAME_MAPPINGS = {"BoxCrop": "✂️ BoxCrop"}
