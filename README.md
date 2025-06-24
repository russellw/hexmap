# Hexmap Editor

A desktop hex map editor built with Electron for creating and editing hexagonal grid maps.

## Features

### Map Editing
- **Hexagonal Grid**: Professional hex grid with axial coordinate system
- **Single-Hex Selection**: Click to select individual hexes with visual highlighting
- **Terrain Types**: 9 terrain types with distinct colors:
  - Unknown (dark gray)
  - Sea (dark blue)
  - Lake (light blue) 
  - Grass (green)
  - Forest (dark green)
  - Jungle (very dark green)
  - Desert (tan)
  - Tundra (light gray-blue)
  - Mountain (brown)
- **Hex Naming**: Optional names for individual hexes
- **Map Sizing**: Customizable map dimensions from 5x5 to 200x200 hexes

### File Operations
- **New/Open/Save/Save As**: Full file management with .hexmap format
- **Current File Tracking**: Shows current filename in title bar
- **PNG Export**: Export maps as high-quality PNG images

### User Interface
- **Touch Support**: Tablet and touch screen compatible
- **Zoom Controls**: Zoom from 30% to 300% with mouse wheel or buttons
- **Pan/Drag**: Right-click drag or touch drag to navigate large maps
- **Toolbar**: Quick access to all tools and settings
- **Status Bar**: Shows hex coordinates and map information
- **Keyboard Shortcuts**:
  - Ctrl+N: New Map
  - Ctrl+O: Open Map
  - Ctrl+S: Save
  - Ctrl+Shift+S: Save As
  - Ctrl+E: Export PNG

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## File Format

Maps are saved in JSON format with `.hexmap` extension containing:
- Map dimensions (width/height)
- Hex data (coordinates, terrain, names)

## System Requirements

- Node.js 16 or higher
- Electron 28 or higher
- Windows, macOS, or Linux

## License

MIT