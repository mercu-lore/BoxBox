"""
Region Selector Node - con endpoint di ridimensionamento lato backend.
Riduce automaticamente le immagini oltre 1024px quando viene aperta
l'interfaccia "Select Box", salvandole in /temp/.
"""

import os
import json
from PIL import Image
import folder_paths
import server


class RegionSelectorNode:
    def __init__(self):
        self.last_metadata = json.dumps({
            "x1": 0, "y1": 0, "x2": 0, "y2": 0,
            "zoom": 1, "borderWidth": 0,
            "borderPosition": "inside", "selected": False
        })

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"image": ("IMAGE",)},
            "optional": {"region_metadata": ("STRING", {"default": "{}", "multiline": True})}
        }

    RETURN_TYPES = ("IMAGE", "STRING")
    RETURN_NAMES = ("image", "region_metadata")
    FUNCTION = "process_region_selection"
    CATEGORY = "image/region"
    OUTPUT_NODE = True

    def process_region_selection(self, image, region_metadata="{}"):
        if region_metadata.strip() and region_metadata != "{}":
            self.last_metadata = region_metadata
        return (image, self.last_metadata)


def scale_image_if_needed(filename, max_size=1024):
    input_path = folder_paths.get_input_directory()
    full_path = os.path.join(input_path, filename)
    if not os.path.exists(full_path):
        return {"error": "file non trovato"}

    with Image.open(full_path) as im:
        w, h = im.size
        if w <= max_size and h <= max_size:
            return {"scaled": False, "path": f"view?filename={filename}&type=input"}

        scale_factor = min(max_size / w, max_size / h)
        new_size = (int(w * scale_factor), int(h * scale_factor))
        im_resized = im.resize(new_size, Image.Resampling.LANCZOS)

        os.makedirs("temp", exist_ok=True)
        scaled_name = f"scaled_{filename}"
        scaled_path = os.path.join("temp", scaled_name)
        im_resized.save(scaled_path)
        print(f"[RegionSelector] Immagine scalata {w}x{h} -> {new_size[0]}x{new_size[1]}")

    return {"scaled": True, "path": f"view?filename={scaled_name}&type=temp", "scale": scale_factor}


@server.PromptServer.instance.routes.post("/region_selector/scale")
async def scale_image_endpoint(request):
    try:
        data = await request.json()
        filename = data.get("filename")
        if not filename:
            return {"error": "filename mancante"}
        result = scale_image_if_needed(filename)
        return result
    except Exception as e:
        print(f"[RegionSelector] Errore endpoint scale: {e}")
        return {"error": str(e)}


NODE_CLASS_MAPPINGS = {"BoxSelector": RegionSelectorNode}
NODE_DISPLAY_NAME_MAPPINGS = {"BoxSelector": "📦 BoxSelector"}
