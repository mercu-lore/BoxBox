"""
Box Reinsert Node - Nodo per rimettere l'immagine generata nel punto originale
"""

import json
import torch
import numpy as np
from PIL import Image


class BoxReinsertNode:
    """
    Nodo che rimette l'immagine generata nel punto originale.

    Workflow:
    1. BoxSelector → estrae una regione (metadata con x1, x2, y1, y2)
    2. BoxCrop → ritaglia la regione
    3. BoxResize → ridimensiona per generazione (metadata con scale info)
    4. [Generazione AI] → produce immagine generata
    5. BoxReinsert → annulla il resize e rimette nel punto originale

    Input:
    - original_image: Immagine originale intera
    - generated_image: Immagine generata (ridimensionata)
    - box_metadata: Metadata dal BoxSelector (coordinate selezione)
    - resize_metadata: Metadata dal BoxResize (scale info)

    Output:
    - image: Immagine originale con generated_image rimessa nel posto corretto
    """

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "original_image": ("IMAGE",),
                "generated_image": ("IMAGE",),
                "box_metadata": ("STRING",),
                "resize_metadata": ("STRING",),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "reinsert_image"
    CATEGORY = "image/box"

    def reinsert_image(self, original_image, generated_image, box_metadata, resize_metadata):
        """
        Rimette l'immagine generata nel punto originale.

        Se resize_metadata è vuoto, bypassa il resize e rimette direttamente l'immagine generata.

        Args:
            original_image: Immagine originale (B, H, W, C)
            generated_image: Immagine generata/elaborata (B, H, W, C)
            box_metadata: JSON metadata dal BoxSelector con x1, x2, y1, y2
            resize_metadata: JSON metadata dal BoxResize con scale_x, scale_y (opzionale)

        Returns:
            (final_image,): Immagine con generated_image rimessa nel punto corretto
        """

        try:
            box_meta = json.loads(box_metadata)
        except json.JSONDecodeError:
            print("[BoxReinsertNode] Invalid box_metadata JSON")
            return (original_image,)

        # Prova a leggere resize_metadata
        resize_meta = {}
        use_resize = False
        if resize_metadata and resize_metadata.strip() and resize_metadata != "{}":
            try:
                resize_meta = json.loads(resize_metadata)
                use_resize = True
            except json.JSONDecodeError:
                print("[BoxReinsertNode] Invalid resize_metadata JSON, bypassing resize")
                use_resize = False

        # Estrai coordinate della selezione originale
        x1 = box_meta.get("x1", 0)
        x2 = box_meta.get("x2", 0)
        y1 = box_meta.get("y1", 0)
        y2 = box_meta.get("y2", 0)

        # Applica fattore di scala se la preview era stata scalata
        display_scale_factor = box_meta.get("displayScaleFactor", 1.0)
        if display_scale_factor and display_scale_factor != 1.0:
            # Se le coordinate sono state prese da una preview scalata,
            # dividi per il fattore di scala per ottenere le coordinate originali
            x1 = x1 / display_scale_factor
            x2 = x2 / display_scale_factor
            y1 = y1 / display_scale_factor
            y2 = y2 / display_scale_factor
            print(f"[BoxReinsertNode] Scale factor detected: {display_scale_factor}x. Adjusted coordinates.")

        # Normalizza coordinate (assicura che x1 < x2, y1 < y2)
        box_x_start = int(round(min(x1, x2)))
        box_x_end = int(round(max(x1, x2)))
        box_y_start = int(round(min(y1, y2)))
        box_y_end = int(round(max(y1, y2)))

        crop_width = box_x_end - box_x_start
        crop_height = box_y_end - box_y_start

        # Converti immagini a PIL
        original_np = (original_image[0].cpu().numpy() * 255).astype(np.uint8)
        original_pil = Image.fromarray(original_np)

        generated_np = (generated_image[0].cpu().numpy() * 255).astype(np.uint8)
        generated_pil = Image.fromarray(generated_np)

        print(f"[BoxReinsertNode] Generated image size: {generated_pil.size}")
        print(f"[BoxReinsertNode] Target crop size: {crop_width}x{crop_height}")
        print(f"[BoxReinsertNode] Use resize: {use_resize}")

        # Step 1: Ridimensiona solo se resize_metadata è fornito
        if use_resize:
            # Annulla il resize fatto da BoxResize
            print(f"[BoxReinsertNode] Resizing generated image back to crop dimensions...")
            generated_resized = generated_pil.resize((crop_width, crop_height), Image.Resampling.LANCZOS)
            print(f"[BoxReinsertNode] Generated image resized from {generated_pil.size} to {generated_resized.size}")
        else:
            # Bypassa il resize e usa direttamente l'immagine generata
            generated_resized = generated_pil
            print(f"[BoxReinsertNode] Bypassing resize, using generated image as-is")

        # Step 2: Rimetti nel punto originale
        # Crea una copia dell'immagine originale
        final_image = original_pil.copy()

        # Incolla l'immagine generata nel punto corretto
        final_image.paste(generated_resized, (box_x_start, box_y_start))

        # Converti back a tensor
        final_np = np.array(final_image).astype(np.float32) / 255.0
        final_tensor = torch.from_numpy(final_np).unsqueeze(0)

        # Assicurati che il tensor abbia le giuste dimensioni
        channels = original_image.shape[3]
        if final_tensor.shape[-1] != channels:
            if channels == 4 and final_tensor.shape[-1] == 3:
                alpha = torch.ones((final_tensor.shape[0], final_tensor.shape[1], final_tensor.shape[2], 1))
                final_tensor = torch.cat([final_tensor, alpha], dim=-1)
            elif channels == 3 and final_tensor.shape[-1] == 4:
                final_tensor = final_tensor[:, :, :, :3]

        print(f"[BoxReinsertNode] Reinserted generated image at position ({box_x_start}, {box_y_start})")
        print(f"[BoxReinsertNode] Final image size: {final_tensor.shape[2]}x{final_tensor.shape[1]}")

        return (final_tensor,)


NODE_CLASS_MAPPINGS = {"BoxReinsert": BoxReinsertNode}
NODE_DISPLAY_NAME_MAPPINGS = {"BoxReinsert": "🎨 BoxReinsert"}
