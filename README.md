# BoxBox - Complete Image Region Processing Suite

A comprehensive ComfyUI custom nodes package for selecting, cropping, resizing, and reinserting image regions with full metadata tracking.

## 📋 Overview

BoxBox provides a complete workflow for working with specific image regions:

1. **📦 BoxSelector** - Interactive interface to select rectangular regions on images
2. **✂️ BoxCrop** - Crop selected regions from original images
3. **📦 BoxResize** - Resize cropped regions with preset aspect ratios for AI generation
4. **🎨 BoxReinsert** - Reinsert generated images back into original positions

## 🎯 Available Nodes

### 1. BoxSelector (📦 BoxSelector)

<p align="center">
  <img src="image/box_selector.png" width="700" alt="BoxBox Preview">
</p>

Interactive interface to select rectangular regions on images.

#### Input
- `image` (IMAGE): Source image to select from

#### Output
- `image` (IMAGE): Original image (passthrough)
- `region_metadata` (STRING): JSON with selection coordinates

#### Features
- 🖱️ **Interactive Selection**: Click and drag to draw rectangles
- 📐 **Side Coordinates**: Returns x1, x2, y1, y2 (not x, y, width, height)
- 🔄 **Clear Button**: Reset selection and start over
- 📊 **Live Coordinates**: Shows selection position in real-time

#### Output JSON Format
```json
{
    "x1": 100,
    "y1": 150,
    "x2": 600,
    "y2": 450,
    "selected": true
}
```

---

### 2. BoxCrop (✂️ BoxCrop)

Crops images according to coordinates provided by BoxSelector.

#### Input
- `image` (IMAGE): Image to crop
- `region_metadata` (STRING): JSON coordinates from BoxSelector (x1, x2, y1, y2)

#### Optional Input
- `fallback_mode` (COMBO): Behavior when no valid coordinates
  - `use_full_image`: Return entire image (default)
  - `return_zero`: Return black image
  - `error`: Raise error

#### Output
- `cropped_image` (IMAGE): Cropped region

#### How It Works
1. Extracts x1, x2, y1, y2 from metadata
2. Normalizes coordinates (ensures x1 < x2, y1 < y2)
3. Clips to image boundaries
4. Crops the specified region

---

### 3. BoxResize (📦 BoxResize)

Resizes cropped regions with preset aspect ratios or custom dimensions, with full metadata tracking.

#### Input
- `image` (IMAGE): Image to resize
- `size` (COMBO): Preset selection or "Custom"
  - `1:1 Square 1024x1024`
  - `3:4 Portrait 896x1152`
  - `5:8 Portrait 832x1216`
  - `9:16 Portrait 768x1344`
  - `9:21 Portrait 640x1536`
  - `4:3 Landscape 1152x896`
  - `3:2 Landscape 1216x832`
  - `16:9 Landscape 1344x768`
  - `21:9 Landscape 1536x640`
  - `Custom` (use width/height parameters)

#### Optional Input
- `keep_aspect_ratio` (BOOLEAN): Maintain original aspect ratio (default: True)
- `interpolation_mode` (COMBO): Resize algorithm
  - `bilinear` (default, faster)
  - `bicubic` (higher quality)
  - `nearest` (pixel-perfect)
- `width` (INT): Custom width [64-8192, step 8] (when size = "Custom")
- `height` (INT): Custom height [64-8192, step 8] (when size = "Custom")

#### Output
- `image` (IMAGE): Resized image
- `resize_metadata` (STRING): JSON with resize information

#### Output JSON Format
```json
{
    "original_width": 500,
    "original_height": 300,
    "resized_width": 1024,
    "resized_height": 1024,
    "scale_x": 2.048,
    "scale_y": 3.413,
    "size_preset": "1:1 Square 1024x1024",
    "keep_aspect_ratio": true,
    "interpolation_mode": "bilinear"
}
```

---

### 4. BoxReinsert (🎨 BoxReinsert)

Reinserts generated images back into original positions using metadata.

#### Input
- `original_image` (IMAGE): Original full-size image
- `generated_image` (IMAGE): Generated/processed image
- `box_metadata` (STRING): Selection coordinates from BoxSelector
- `resize_metadata` (STRING): Resize information from BoxResize

#### Output
- `image` (IMAGE): Final image with generated content reinserted

#### How It Works
1. Reads box_metadata for original selection position (x1, x2, y1, y2)
2. If resize_metadata is provided:
   - Resizes generated_image back to crop dimensions
   - Inserts at exact original position
3. If resize_metadata is empty:
   - Inserts generated_image as-is (bypasses resize reversal)
4. Returns full image with processed region in place

#### Flexible Workflow
- **With Resize**: Generated → De-resize → Reinsert
- **Without Resize**: Generated → Reinsert directly

---

## 🔄 Complete Workflow

### Standard AI Generation Workflow
```
LoadImage
    ↓
📦 BoxSelector (select region interactively)
    ↓ box_metadata
✂️ BoxCrop (extract region)
    ↓ cropped_image
📦 BoxResize (prepare for AI, e.g., 1024x1024)
    ↓ resize_metadata
[AI Generation Model - SDXL, SD, etc.]
    ↓ generated_image
🎨 BoxReinsert (put back in original position)
    ↓
Output: Final image with AI-generated region
```

### Direct Editing Workflow (skip resize)
```
LoadImage
    ↓
📦 BoxSelector (select region)
    ↓ box_metadata
✂️ BoxCrop (extract region)
    ↓ cropped_image
[Edit/Filter directly]
    ↓ edited_image
🎨 BoxReinsert (reinsert without resize)
    ↓
Output: Final image
```

---

## 💡 Metadata System

The metadata system ensures complete traceability:

1. **BoxSelector Output**: `{"x1": ..., "y1": ..., "x2": ..., "y2": ...}`
   - Stores original selection coordinates

2. **BoxResize Output**: `{"original_width": ..., "resized_width": ..., "scale_x": ..., ...}`
   - Tracks resize transformation for reversal

3. **BoxReinsert**: Uses both to:
   - Know where region was selected (box_metadata)
   - Know how to de-scale (resize_metadata)
   - Reinsert at exact original location

---

## ⚙️ Settings & Presets

### BoxSelector
- **Border Width**: Fixed at 3px (built-in)
- **Border Position**: Fixed at "inside" (built-in)

### BoxResize Presets
All presets optimize for AI generation models:
- **Square**: 1:1 ratio at 1024x1024
- **Portrait**: Multiple heights (3:4, 5:8, 9:16, 9:21)
- **Landscape**: Multiple widths (4:3, 3:2, 16:9, 21:9)

### BoxResize Interpolation
- `bilinear`: Fast, good quality (default)
- `bicubic`: Slower, higher quality
- `nearest`: Pixel-perfect, no smoothing

---

## 🔄 Coordinate System

All nodes use **side coordinates (x1, x2, y1, y2)**:
- `x1`: Left edge
- `x2`: Right edge
- `y1`: Top edge
- `y2`: Bottom edge

This allows:
- Easy understanding of selected region
- Automatic validation (x1 < x2, y1 < y2)
- Direct use for cropping and reinsertion

---

## 🎨 User Interface

### BoxSelector Dialog

**Left Panel (Controls)**
- Image name
- Clear Selection button
- Selection coordinates display

**Right Panel (Canvas)**
- Interactive image canvas
- Click + drag to draw rectangle
- Drag handles to resize
- Drag body to move

---

## 📦 Installation

1. Clone/copy the BoxBox folder to:
   ```
   ComfyUI/custom_nodes/BoxBox/
   ```

2. Restart ComfyUI

3. Nodes will appear in `image/box` category

---

## 📋 Requirements

- **ComfyUI**: Latest version
- **Python**: 3.8+
- **PyTorch**: >= 2.0.0
- **Pillow (PIL)**: >= 8.0.0
- **NumPy**: >= 1.20.0
- **torch.nn.functional**: For interpolation (included with PyTorch)

### requirements.txt
```
torch>=2.0.0
Pillow>=8.0.0
numpy>=1.20.0
```

---

## 🚀 Quick Start

1. Add **LoadImage** node
2. Add **📦 BoxSelector** node, connect image
3. Click "📦 Select Box" button
4. Draw rectangle on image, click "✅ Confirm"
5. Add **✂️ BoxCrop**, connect BoxSelector output
6. Add **📦 BoxResize**, select preset (e.g., "1:1 Square 1024x1024")
7. Send to AI model or editor
8. Add **🎨 BoxReinsert**:
   - Connect original image from step 1
   - Connect generated image from step 7
   - Connect box_metadata from step 4 output
   - Connect resize_metadata from step 6 output
9. Execute graph → final image!

---

## 🐛 Troubleshooting

### Selection Dialog Doesn't Open
- Make sure image is connected to BoxSelector
- Check browser console (F12) for errors
- Try reloading page (Ctrl+Shift+R)

### Drawing Rectangle Doesn't Work
- Ensure you're clicking inside the image area
- Check that cursor shows crosshair
- Try refreshing the page

### Resize Creates Black/Empty Image
- Check that `keep_aspect_ratio` is set correctly
- Verify image dimensions are valid
- Try different `interpolation_mode`

### Reinsert Doesn't Work
- Verify all 4 inputs are connected (original_image, generated_image, box_metadata, resize_metadata)
- Check that metadata JSON is valid
- Ensure original_image and box_metadata match (same image used for selection)

---

## 📝 Changelog

### v1.0.0 (Current)
- ✅ BoxSelector with interactive region selection
- ✅ BoxCrop with coordinate-based cropping
- ✅ BoxResize with preset aspect ratios and custom sizes
- ✅ BoxReinsert with flexible resize handling
- ✅ Complete metadata tracking system
- ✅ Optional resize bypass in BoxReinsert
- ✅ Multiple interpolation modes

---

## 🎓 Advanced Usage

### Chaining Multiple Regions
```
Select Region 1 → Crop → Resize → AI Generate → Reinsert
Parallel with:
Select Region 2 → Crop → Resize → AI Generate → Reinsert
```

### Batch Processing
Use Reroute nodes to process same coordinates on multiple images.

### Custom Aspect Ratios
Use BoxResize with "Custom" mode and specify exact width/height.

---

## 📄 License

MIT

---

## 🤝 Support

For issues, feature requests, or suggestions, please contact the developer.

---

**Created for ComfyUI** - Transform your images with precision! 🎯✂️📦🎨
