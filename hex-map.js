const { ipcRenderer } = require('electron');

class HexMapEditor {
    constructor() {
        this.canvas = document.getElementById('hex-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.mapWidth = 20;
        this.mapHeight = 20;
        this.hexSize = 20;
        this.hexMap = new Map();
        this.selectedTerrain = 'grass';
        this.brushSize = 1;
        this.hoveredHex = null;
        
        this.terrainColors = {
            grass: '#4a7c59',
            water: '#1e5f8b',
            mountain: '#8b5a2b',
            forest: '#2d5016',
            desert: '#deb887'
        };
        
        this.initCanvas();
        this.initEventListeners();
        this.initElectronListeners();
        this.generateInitialMap();
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
        const brushSizeSlider = document.getElementById('brush-size');
        const brushSizeValue = document.getElementById('brush-size-value');
        const clearMapBtn = document.getElementById('clear-map');
        
        terrainSelect.addEventListener('change', (e) => {
            this.selectedTerrain = e.target.value;
        });
        
        brushSizeSlider.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            brushSizeValue.textContent = this.brushSize;
        });
        
        clearMapBtn.addEventListener('click', () => {
            this.clearMap();
        });
        
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredHex = null;
            this.render();
        });
    }
    
    initElectronListeners() {
        ipcRenderer.on('new-map', () => {
            this.generateInitialMap();
            this.render();
        });
        
        ipcRenderer.on('load-map', (event, mapData) => {
            this.loadMap(mapData);
        });
        
        ipcRenderer.on('save-map', () => {
            this.saveMap();
        });
    }
    
    generateInitialMap() {
        this.hexMap.clear();
        for (let q = 0; q < this.mapWidth; q++) {
            for (let r = 0; r < this.mapHeight; r++) {
                const key = `${q},${r}`;
                this.hexMap.set(key, {
                    q: q,
                    r: r,
                    terrain: 'grass'
                });
            }
        }
    }
    
    clearMap() {
        for (let [key, hex] of this.hexMap) {
            hex.terrain = 'grass';
        }
        this.render();
    }
    
    hexToPixel(q, r) {
        const x = this.hexSize * (3/2 * q);
        const y = this.hexSize * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
        return { x: x + this.canvas.width / 2 - (this.mapWidth * this.hexSize * 3/4), 
                 y: y + this.canvas.height / 2 - (this.mapHeight * this.hexSize * Math.sqrt(3)/2) };
    }
    
    pixelToHex(x, y) {
        const offsetX = x - (this.canvas.width / 2 - (this.mapWidth * this.hexSize * 3/4));
        const offsetY = y - (this.canvas.height / 2 - (this.mapHeight * this.hexSize * Math.sqrt(3)/2));
        
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
            
            if (this.hoveredHex && this.hoveredHex.q === hex.q && this.hoveredHex.r === hex.r) {
                strokeColor = '#ffffff';
                lineWidth = 2;
            }
            
            this.drawHex(pixel.x, pixel.y, this.hexSize, color, strokeColor, lineWidth);
        }
        
        if (this.hoveredHex) {
            this.drawBrushPreview();
        }
    }
    
    drawBrushPreview() {
        if (!this.hoveredHex) return;
        
        const affected = this.getHexesInRadius(this.hoveredHex.q, this.hoveredHex.r, this.brushSize - 1);
        
        for (let hex of affected) {
            if (this.hexMap.has(`${hex.q},${hex.r}`)) {
                const pixel = this.hexToPixel(hex.q, hex.r);
                this.ctx.save();
                this.ctx.strokeStyle = '#ffff00';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([5, 5]);
                this.ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = i * Math.PI / 3;
                    const x = pixel.x + this.hexSize * Math.cos(angle);
                    const y = pixel.y + this.hexSize * Math.sin(angle);
                    if (i === 0) {
                        this.ctx.moveTo(x, y);
                    } else {
                        this.ctx.lineTo(x, y);
                    }
                }
                this.ctx.closePath();
                this.ctx.stroke();
                this.ctx.restore();
            }
        }
    }
    
    getHexesInRadius(centerQ, centerR, radius) {
        const results = [];
        for (let q = -radius; q <= radius; q++) {
            const r1 = Math.max(-radius, -q - radius);
            const r2 = Math.min(radius, -q + radius);
            for (let r = r1; r <= r2; r++) {
                results.push({ q: centerQ + q, r: centerR + r });
            }
        }
        return results;
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const hex = this.pixelToHex(x, y);
        
        if (this.hexMap.has(`${hex.q},${hex.r}`)) {
            this.hoveredHex = hex;
            document.getElementById('hex-info').textContent = `Hex: (${hex.q}, ${hex.r})`;
        } else {
            this.hoveredHex = null;
            document.getElementById('hex-info').textContent = 'Hover over hexes to see coordinates';
        }
        
        this.render();
    }
    
    handleClick(e) {
        if (!this.hoveredHex) return;
        
        const affected = this.getHexesInRadius(this.hoveredHex.q, this.hoveredHex.r, this.brushSize - 1);
        
        for (let hex of affected) {
            const key = `${hex.q},${hex.r}`;
            if (this.hexMap.has(key)) {
                this.hexMap.get(key).terrain = this.selectedTerrain;
            }
        }
        
        this.render();
    }
    
    saveMap() {
        const mapData = {
            width: this.mapWidth,
            height: this.mapHeight,
            hexes: Array.from(this.hexMap.values())
        };
        
        ipcRenderer.invoke('save-map-dialog', mapData);
    }
    
    loadMap(mapData) {
        this.mapWidth = mapData.width;
        this.mapHeight = mapData.height;
        this.hexMap.clear();
        
        for (let hex of mapData.hexes) {
            const key = `${hex.q},${hex.r}`;
            this.hexMap.set(key, hex);
        }
        
        document.getElementById('map-info').textContent = `Map: ${this.mapWidth}x${this.mapHeight}`;
        this.render();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new HexMapEditor();
});