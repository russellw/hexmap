const { ipcRenderer } = require('electron');

class HexMapEditor {
    constructor() {
        this.canvas = document.getElementById('hex-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.mapWidth = 20;
        this.mapHeight = 20;
        this.hexSize = 20;
        this.baseHexSize = 20;
        this.zoomLevel = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.hexMap = new Map();
        this.hoveredHex = null;
        this.selectedHex = null;
        this.currentFilePath = null;
        
        this.terrainColors = {
            unknown: '#333333',
            grass: '#7cb342',
            sea: '#1e4d72',
            lake: '#4a90e2',
            mountain: '#8b5a2b',
            forest: '#228b22',
            desert: '#deb887',
            jungle: '#0d3d0d',
            tundra: '#b8c6db'
        };
        
        this.initCanvas();
        this.initEventListeners();
        this.initElectronListeners();
        this.generateInitialMap();
        this.updateZoomDisplay();
        this.render();
    }
    
    initCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const container = document.getElementById('canvas-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }
    
    initEventListeners() {
        const terrainSelect = document.getElementById('terrain-select');
        const hexNameInput = document.getElementById('hex-name-input');
        const applyNameBtn = document.getElementById('apply-name');
        const newBtn = document.getElementById('new-btn');
        const openBtn = document.getElementById('open-btn');
        const saveBtn = document.getElementById('save-btn');
        const saveAsBtn = document.getElementById('save-as-btn');
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const zoomResetBtn = document.getElementById('zoom-reset');
        
        terrainSelect.addEventListener('change', (e) => {
            if (this.selectedHex) {
                const hexData = this.hexMap.get(`${this.selectedHex.q},${this.selectedHex.r}`);
                if (hexData) {
                    hexData.terrain = e.target.value;
                    this.render();
                }
            }
        });
        
        applyNameBtn.addEventListener('click', () => {
            if (this.selectedHex) {
                const hexData = this.hexMap.get(`${this.selectedHex.q},${this.selectedHex.r}`);
                if (hexData) {
                    hexData.name = hexNameInput.value.trim();
                    this.updateSelectedHexInfo();
                    this.render();
                }
            }
        });
        
        hexNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                applyNameBtn.click();
            }
        });
        
        
        newBtn.addEventListener('click', () => {
            this.newMap();
        });
        
        openBtn.addEventListener('click', () => {
            this.openMap();
        });
        
        saveBtn.addEventListener('click', () => {
            this.save();
        });
        
        saveAsBtn.addEventListener('click', () => {
            this.saveAs();
        });
        
        zoomInBtn.addEventListener('click', () => {
            this.zoom(0.1);
        });
        
        zoomOutBtn.addEventListener('click', () => {
            this.zoom(-0.1);
        });
        
        zoomResetBtn.addEventListener('click', () => {
            this.resetZoom();
        });
        
        
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredHex = null;
            this.isDragging = false;
            this.render();
        });
        
        // Touch events for tablets/mobile
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
    }
    
    initElectronListeners() {
        if (typeof ipcRenderer !== 'undefined') {
            ipcRenderer.on('new-map', () => {
                this.generateInitialMap();
                this.render();
            });
            
            ipcRenderer.on('load-map', (event, mapData, filePath) => {
                this.loadMap(mapData, filePath);
            });
            
            ipcRenderer.on('save-map', (event, filePath) => {
                this.saveMapDirect(filePath);
            });
            
            ipcRenderer.on('save-as-map', () => {
                this.saveAsMap();
            });
            
            ipcRenderer.on('show-resize-dialog', () => {
                this.showResizeDialog();
            });
        }
    }
    
    generateInitialMap() {
        this.hexMap.clear();
        this.currentFilePath = null;
        this.selectedHex = null;
        this.updateSelectedHexInfo();
        for (let q = 0; q < this.mapWidth; q++) {
            for (let r = 0; r < this.mapHeight; r++) {
                const key = `${q},${r}`;
                this.hexMap.set(key, {
                    q: q,
                    r: r,
                    terrain: 'unknown',
                    name: ''
                });
            }
        }
    }
    
    clearMap() {
        for (let [key, hex] of this.hexMap) {
            hex.terrain = 'unknown';
        }
        this.render();
    }
    
    hexToPixel(q, r) {
        const x = this.hexSize * (3/2 * q);
        const y = this.hexSize * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
        return { x: x + this.canvas.width / 2 - (this.mapWidth * this.hexSize * 3/4) + this.offsetX, 
                 y: y + this.canvas.height / 2 - (this.mapHeight * this.hexSize * Math.sqrt(3)/2) + this.offsetY };
    }
    
    pixelToHex(x, y) {
        const adjustedX = x - this.offsetX;
        const adjustedY = y - this.offsetY;
        const offsetX = adjustedX - (this.canvas.width / 2 - (this.mapWidth * this.hexSize * 3/4));
        const offsetY = adjustedY - (this.canvas.height / 2 - (this.mapHeight * this.hexSize * Math.sqrt(3)/2));
        
        const q = (2/3 * offsetX) / this.hexSize;
        const r = (-1/3 * offsetX + Math.sqrt(3)/3 * offsetY) / this.hexSize;
        
        return this.roundHex(q, r);
    }
    
    roundHex(q, r) {
        const s = -q - r;
        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);
        
        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);
        
        if (qDiff > rDiff && qDiff > sDiff) {
            rq = -rr - rs;
        } else if (rDiff > sDiff) {
            rr = -rq - rs;
        }
        
        return { q: rq, r: rr };
    }
    
    drawHex(centerX, centerY, size, fillColor, strokeColor = '#666', lineWidth = 1) {
        this.ctx.save();
        this.ctx.fillStyle = fillColor;
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = lineWidth;
        
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            const x = centerX + size * Math.cos(angle);
            const y = centerY + size * Math.sin(angle);
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let [key, hex] of this.hexMap) {
            const pixel = this.hexToPixel(hex.q, hex.r);
            const color = this.terrainColors[hex.terrain];
            
            let strokeColor = '#666';
            let lineWidth = 1;
            
            if (this.selectedHex && this.selectedHex.q === hex.q && this.selectedHex.r === hex.r) {
                strokeColor = '#ff0000';
                lineWidth = 3;
            } else if (this.hoveredHex && this.hoveredHex.q === hex.q && this.hoveredHex.r === hex.r) {
                strokeColor = '#ffffff';
                lineWidth = 2;
            }
            
            this.drawHex(pixel.x, pixel.y, this.hexSize, color, strokeColor, lineWidth);
            
            // Draw hex name if it exists
            if (hex.name && this.hexSize > 15) {
                this.ctx.save();
                this.ctx.fillStyle = '#ffffff';
                this.ctx.strokeStyle = '#000000';
                this.ctx.lineWidth = 2;
                this.ctx.font = `${Math.max(8, this.hexSize * 0.3)}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.strokeText(hex.name, pixel.x, pixel.y);
                this.ctx.fillText(hex.name, pixel.x, pixel.y);
                this.ctx.restore();
            }
        }
    }
    
    
    handleMouseDown(e) {
        if (e.button === 2) { // Right mouse button
            e.preventDefault();
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
        }
    }
    
    handleMouseUp(e) {
        if (e.button === 2) { // Right mouse button
            this.isDragging = false;
            this.canvas.style.cursor = 'crosshair';
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.isDragging) {
            const deltaX = e.clientX - this.lastMouseX;
            const deltaY = e.clientY - this.lastMouseY;
            this.offsetX += deltaX;
            this.offsetY += deltaY;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.render();
            return;
        }
        
        const hex = this.pixelToHex(x, y);
        
        if (this.hexMap.has(`${hex.q},${hex.r}`)) {
            this.hoveredHex = hex;
            const hexData = this.hexMap.get(`${hex.q},${hex.r}`);
            const nameText = hexData.name ? ` - ${hexData.name}` : '';
            document.getElementById('hex-info').textContent = `Hex: (${hex.q}, ${hex.r})${nameText}`;
        } else {
            this.hoveredHex = null;
            document.getElementById('hex-info').textContent = 'Click to select hex | Right-drag to pan';
        }
        
        this.render();
    }
    
    handleClick(e) {
        if (this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const hex = this.pixelToHex(x, y);
        
        if (this.hexMap.has(`${hex.q},${hex.r}`)) {
            this.selectedHex = hex;
            this.updateSelectedHexInfo();
            this.render();
        }
    }
    
    handleDoubleClick(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const hex = this.pixelToHex(x, y);
        
        if (this.hexMap.has(`${hex.q},${hex.r}`)) {
            const hexData = this.hexMap.get(`${hex.q},${hex.r}`);
            const currentName = hexData.name || '';
            const newName = prompt('Enter hex name (leave empty to remove):', currentName);
            
            if (newName !== null) {
                hexData.name = newName.trim();
                this.render();
            }
        }
    }
    
    updateSelectedHexInfo() {
        const selectedHexInfo = document.getElementById('selected-hex-info');
        const terrainSelect = document.getElementById('terrain-select');
        const hexNameInput = document.getElementById('hex-name-input');
        const applyNameBtn = document.getElementById('apply-name');
        
        if (this.selectedHex) {
            const hexData = this.hexMap.get(`${this.selectedHex.q},${this.selectedHex.r}`);
            if (hexData) {
                selectedHexInfo.textContent = `(${this.selectedHex.q}, ${this.selectedHex.r})`;
                terrainSelect.value = hexData.terrain;
                terrainSelect.disabled = false;
                hexNameInput.value = hexData.name || '';
                hexNameInput.disabled = false;
                applyNameBtn.disabled = false;
            }
        } else {
            selectedHexInfo.textContent = 'None';
            terrainSelect.disabled = true;
            hexNameInput.value = '';
            hexNameInput.disabled = true;
            applyNameBtn.disabled = true;
        }
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (this.isDragging && e.touches.length === 1) {
            const deltaX = e.touches[0].clientX - this.lastMouseX;
            const deltaY = e.touches[0].clientY - this.lastMouseY;
            this.offsetX += deltaX;
            this.offsetY += deltaY;
            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;
            this.render();
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        this.isDragging = false;
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        const zoomFactor = 0.1;
        const minZoom = 0.3;
        const maxZoom = 3.0;
        
        if (e.deltaY < 0) {
            // Zoom in
            this.zoomLevel = Math.min(maxZoom, this.zoomLevel + zoomFactor);
        } else {
            // Zoom out
            this.zoomLevel = Math.max(minZoom, this.zoomLevel - zoomFactor);
        }
        
        this.hexSize = this.baseHexSize * this.zoomLevel;
        this.updateZoomDisplay();
        this.render();
    }
    
    zoom(delta) {
        const minZoom = 0.3;
        const maxZoom = 3.0;
        
        this.zoomLevel = Math.max(minZoom, Math.min(maxZoom, this.zoomLevel + delta));
        this.hexSize = this.baseHexSize * this.zoomLevel;
        this.updateZoomDisplay();
        this.render();
    }
    
    resetZoom() {
        this.zoomLevel = 1.0;
        this.hexSize = this.baseHexSize;
        this.offsetX = 0;
        this.offsetY = 0;
        this.updateZoomDisplay();
        this.render();
    }
    
    updateZoomDisplay() {
        document.getElementById('zoom-level').textContent = Math.round(this.zoomLevel * 100) + '%';
    }
    
    saveMapDirect(filePath) {
        const mapData = {
            width: this.mapWidth,
            height: this.mapHeight,
            hexes: Array.from(this.hexMap.values())
        };
        
        ipcRenderer.invoke('save-map-direct', mapData, filePath);
    }
    
    saveAsMap() {
        const mapData = {
            width: this.mapWidth,
            height: this.mapHeight,
            hexes: Array.from(this.hexMap.values())
        };
        
        ipcRenderer.invoke('save-map-dialog', mapData).then(result => {
            if (result.success) {
                this.currentFilePath = result.filePath;
            }
        });
    }
    
    loadMap(mapData, filePath = null) {
        this.mapWidth = mapData.width;
        this.mapHeight = mapData.height;
        this.hexMap.clear();
        this.currentFilePath = filePath;
        
        for (let hex of mapData.hexes) {
            const key = `${hex.q},${hex.r}`;
            this.hexMap.set(key, hex);
        }
        
        document.getElementById('map-info').textContent = `Map: ${this.mapWidth}x${this.mapHeight}`;
        
        // Update main process title bar
        if (typeof ipcRenderer !== 'undefined') {
            ipcRenderer.send('update-title', filePath);
        }
        
        this.render();
    }
    
    resizeMap(newWidth, newHeight) {
        if (newWidth < 5 || newWidth > 50 || newHeight < 5 || newHeight > 50) {
            alert('Map size must be between 5x5 and 50x50');
            return;
        }
        
        const oldMap = new Map(this.hexMap);
        this.mapWidth = newWidth;
        this.mapHeight = newHeight;
        this.hexMap.clear();
        
        for (let q = 0; q < this.mapWidth; q++) {
            for (let r = 0; r < this.mapHeight; r++) {
                const key = `${q},${r}`;
                const existingHex = oldMap.get(key);
                this.hexMap.set(key, {
                    q: q,
                    r: r,
                    terrain: existingHex ? existingHex.terrain : 'unknown',
                    name: existingHex ? existingHex.name || '' : ''
                });
            }
        }
        
        document.getElementById('map-info').textContent = `Map: ${this.mapWidth}x${this.mapHeight}`;
        this.render();
    }
    
    newMap() {
        this.generateInitialMap();
        this.render();
    }
    
    openMap() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.hexmap';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const text = await file.text();
                    const mapData = JSON.parse(text);
                    this.loadMap(mapData, file.name);
                } catch (error) {
                    alert('Error loading map file: ' + error.message);
                }
            }
        };
        input.click();
    }
    
    save() {
        if (this.currentFilePath) {
            this.saveMapDirect(this.currentFilePath);
        } else {
            this.saveAs();
        }
    }
    
    saveAs() {
        this.saveAsMap();
    }
    
    showResizeDialog() {
        
        // Create modal dialog
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #3c3c3c;
            color: white;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #666;
            min-width: 300px;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin-top: 0;">Resize Map</h3>
            <div style="margin: 15px 0;">
                <label>Width (5-50): </label>
                <input type="number" id="dialog-width" min="5" max="50" value="${this.mapWidth}" style="width: 80px; margin-left: 10px;">
            </div>
            <div style="margin: 15px 0;">
                <label>Height (5-50): </label>
                <input type="number" id="dialog-height" min="5" max="50" value="${this.mapHeight}" style="width: 80px; margin-left: 10px;">
            </div>
            <div style="margin-top: 20px; text-align: right;">
                <button id="dialog-cancel" style="margin-right: 10px;">Cancel</button>
                <button id="dialog-ok">OK</button>
            </div>
        `;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        // Focus the width input
        const widthInput = dialog.querySelector('#dialog-width');
        widthInput.focus();
        widthInput.select();
        
        // Handle buttons
        dialog.querySelector('#dialog-cancel').onclick = () => {
            document.body.removeChild(modal);
        };
        
        dialog.querySelector('#dialog-ok').onclick = () => {
            const width = parseInt(dialog.querySelector('#dialog-width').value);
            const height = parseInt(dialog.querySelector('#dialog-height').value);
            
            if (isNaN(width) || width < 5 || width > 50) {
                alert('Width must be between 5 and 50');
                return;
            }
            
            if (isNaN(height) || height < 5 || height > 50) {
                alert('Height must be between 5 and 50');
                return;
            }
            
            document.body.removeChild(modal);
            this.resizeMap(width, height);
        };
        
        // Handle Enter key
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                dialog.querySelector('#dialog-ok').click();
            } else if (e.key === 'Escape') {
                dialog.querySelector('#dialog-cancel').click();
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new HexMapEditor();
});