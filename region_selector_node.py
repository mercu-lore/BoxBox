"""
BoxSelector Node - Interactive region selection with auto-scaling for large images.
Automatically scales images > 1024px in preview for smooth selection.
Outputs box_metadata with coordinates and displayScaleFactor.
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
            "optional": {"box_metadata": ("STRING", {"default": "", "multiline": True})}
        }

    RETURN_TYPES = ("IMAGE", "STRING")
    RETURN_NAMES = ("image", "box_metadata")
    FUNCTION = "process_region_selection"
    CATEGORY = "image/region"
    OUTPUT_NODE = True

    def process_region_selection(self, image, box_metadata="{}"):
        if box_metadata.strip() and box_metadata != "{}":
            self.last_metadata = box_metadata
        return (image, self.last_metadata)


def scale_image_if_needed(filename, type="input", subfolder="", max_size=1024):
    if type == "output":
        base_dir = folder_paths.get_output_directory()
    elif type == "temp":
        base_dir = folder_paths.get_temp_directory()
    else:
        base_dir = folder_paths.get_input_directory()

    if subfolder:
        full_path = os.path.join(base_dir, subfolder, filename)
    else:
        full_path = os.path.join(base_dir, filename)

    if not os.path.exists(full_path):
        return {"error": f"file not found: {full_path}"}

    with Image.open(full_path) as im:
        w, h = im.size
        # Use comma as separator for filename, type, subfolder to assume default behaviour or backward compatibility
        path_params = f"filename={filename}&type={type}"
        if subfolder:
            path_params += f"&subfolder={subfolder}"

        if w <= max_size and h <= max_size:
            return {"scaled": False, "path": f"/view?{path_params}"}

        scale_factor = min(max_size / w, max_size / h)
        new_size = (int(w * scale_factor), int(h * scale_factor))
        im_resized = im.resize(new_size, Image.Resampling.LANCZOS)

        # Use ComfyUI's temp folder
        temp_dir = folder_paths.get_temp_directory()
        os.makedirs(temp_dir, exist_ok=True)
        
        # Sanitize filename: replace path separators with underscores
        safe_filename = filename.replace('/', '_').replace('\\', '_')
        if subfolder:
            safe_filename = f"{subfolder}_{safe_filename}".replace('/', '_').replace('\\', '_')
            
        scaled_name = f"scaled_{safe_filename}"
        scaled_path = os.path.join(temp_dir, scaled_name)
        im_resized.save(scaled_path)
        print(f"[RegionSelector] Image scaled {w}x{h} -> {new_size[0]}x{new_size[1]}")

    return {"scaled": True, "path": f"/view?filename={scaled_name}&type=temp", "scale": scale_factor}


@server.PromptServer.instance.routes.post("/region_selector/scale")
async def scale_image_endpoint(request):
    from aiohttp import web
    try:
        # Intentar leer el JSON de forma segura
        try:
            data = await request.json()
        except:
            # Fallback si el content-type no es exacto o el cuerpo está malformado
            post_data = await request.post()
            data = dict(post_data)
        
        filename = data.get("filename")
        type_ = data.get("type", "input")
        subfolder = data.get("subfolder", "")
        
        if not filename:
            return web.json_response({"error": "filename missing"}, status=400)
            
        result = scale_image_if_needed(filename, type_, subfolder)
        return web.json_response(result)
    except Exception as e:
        print(f"[BoxBox] Error in scale endpoint: {e}")
        return web.json_response({"error": str(e)}, status=500)


NODE_CLASS_MAPPINGS = {"BoxSelector": RegionSelectorNode}
NODE_DISPLAY_NAME_MAPPINGS = {"BoxSelector": "📦 BoxSelector"}
