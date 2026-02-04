# Changelog

All notable changes to this enhanced version of BoxBox will be documented in this file.

## [Enhanced v1.0.0] - 2026-01-19

### Added
- **Aspect Ratio Memory**: Remembers last selected aspect ratio using localStorage
- **Selection Restoration**: Automatically restores previous selection when reopening
- **Recursive Node Traversal**: Finds source images through intermediate processing nodes
- **Better Error Handling**: Image error handler with console logging
- **Improved Coordinate Logic**: Refined the balance between frontend and backend scaling to ensure pixel-perfect crops.
- **Removed Annoying Popups**: Removed the "Immagine già piccola" alert which interrupted the workflow.

### Fixed
- **Image Loading**: Updated URL construction for ComfyUI compatibility
- **Backend Issues**: 
  - Fixed temp directory to use `folder_paths.get_temp_directory()`
  - Fixed HTTP responses to return proper `web.json_response()`
  - Sanitized filenames to prevent path separator issues
- **Coordinate Scaling**: Removed duplicate division, now handled correctly by backend
- **Intermediate Nodes**: Now works with Brightness, Blur, and other processing nodes
- **Coord Sync**: Reverted frontend division to allow the backend `BoxCrop` to handle scaling, preventing "double-scaling" errors.
- **UI Polish**: Silenced the "already small" alert popup.

### Changed
- Removed annoying popup alert for small images
- Improved console logging throughout
- Aspect ratio now stays locked when drawing new selections

### Technical Details
- Added `findImageInChain()` recursive function (max depth: 20)
- Updated `openRegionDialog()` to use chain traversal
- Added `api` module import for proper URL construction
- Enhanced scale endpoint with better filename extraction

---

## [Original] - Before 2026-01-19

Original BoxBox implementation by mercu-lore.
