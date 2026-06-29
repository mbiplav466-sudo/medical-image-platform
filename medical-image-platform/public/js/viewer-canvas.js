// viewer-canvas.js

export class PacsViewer {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`Canvas with id ${canvasId} not found.`);
      return;
    }
    this.ctx = this.canvas.getContext('2d');
    
    // Callbacks
    this.onViewportChange = options.onViewportChange || (() => {});
    this.onMouseMoveCoords = options.onMouseMoveCoords || (() => {});
    this.onMeasurementAdded = options.onMeasurementAdded || (() => {});
    this.onRoiAdded = options.onRoiAdded || (() => {});

    // State Variables
    this.img = null;
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    
    // Adjustments
    this.brightness = 1.0;
    this.contrast = 1.0;
    this.invert = false;
    
    // Overlays
    this.showGrid = false;
    this.showHeatmap = false;
    this.heatmapPoints = [];
    this.boundingBoxes = [];
    this.measurements = []; // Array of {x1, y1, x2, y2, label} in image coords
    
    // Tools
    this.activeTool = 'pan-zoom'; // 'pan-zoom' | 'measure' | 'draw-roi'
    
    // Calibration (1 pixel = 0.15mm)
    this.calibrationMmPerPixel = 0.15;

    // Interaction states
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.activeMeasure = null; // {x1, y1, x2, y2}
    this.activeRoi = null; // {x, y, w, h}
    
    this.initEvents();
    this.resizeCanvas();
  }

  resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
    }
    this.draw();
  }

  setImage(imageSrc, callback) {
    const loader = new Image();
    loader.onload = () => {
      this.img = loader;
      this.resetView();
      if (callback) callback();
    };
    loader.src = imageSrc;
  }

  resetView() {
    if (!this.img) return;

    // Center and scale image to fit canvas comfortably
    const canvasRatio = this.canvas.width / this.canvas.height;
    const imgRatio = this.img.width / this.img.height;

    if (imgRatio > canvasRatio) {
      this.zoom = (this.canvas.width * 0.8) / this.img.width;
    } else {
      this.zoom = (this.canvas.height * 0.8) / this.img.height;
    }
    
    // Clamp zoom to standard values
    this.zoom = Math.round(this.zoom * 100) / 100;

    this.panX = (this.canvas.width - this.img.width * this.zoom) / 2;
    this.panY = (this.canvas.height - this.img.height * this.zoom) / 2;

    this.brightness = 1.0;
    this.contrast = 1.0;
    this.invert = false;
    this.measurements = [];
    
    this.updateViewportHud();
    this.draw();
  }

  updateViewportHud() {
    this.onViewportChange({
      zoom: Math.round(this.zoom * 100),
      dims: this.img ? `${this.img.width} x ${this.img.height}` : '0 x 0',
      window: `B: ${Math.round(this.brightness * 100)}% / C: ${Math.round(this.contrast * 100)}%`
    });
  }

  setBrightness(val) {
    this.brightness = parseFloat(val);
    this.updateViewportHud();
    this.draw();
  }

  setContrast(val) {
    this.contrast = parseFloat(val);
    this.updateViewportHud();
    this.draw();
  }

  setInvert(val) {
    this.invert = !!val;
    this.draw();
  }

  setTool(tool) {
    this.activeTool = tool;
    this.draw();
  }

  toggleGrid(val) {
    this.showGrid = val !== undefined ? !!val : !this.showGrid;
    this.draw();
  }

  toggleHeatmap(val) {
    this.showHeatmap = val !== undefined ? !!val : !this.showHeatmap;
    this.draw();
  }

  initEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());

    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    
    // Prevent context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Helper: Convert screen coordinate to image coordinate
  screenToImage(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;
    return {
      x: (x - this.panX) / this.zoom,
      y: (y - this.panY) / this.zoom
    };
  }

  handleMouseDown(e) {
    if (!this.img) return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const imgCoords = this.screenToImage(e.clientX, e.clientY);

    // Left click handling based on active tool
    if (e.button === 0) {
      if (this.activeTool === 'pan-zoom') {
        this.isDragging = true;
        this.dragStart = { x: mouseX - this.panX, y: mouseY - this.panY };
      } else if (this.activeTool === 'measure') {
        this.activeMeasure = {
          x1: imgCoords.x,
          y1: imgCoords.y,
          x2: imgCoords.x,
          y2: imgCoords.y
        };
      } else if (this.activeTool === 'draw-roi') {
        this.activeRoi = {
          x: imgCoords.x,
          y: imgCoords.y,
          w: 0,
          h: 0
        };
      }
    } 
    // Middle click is always pan
    else if (e.button === 1) {
      this.isDragging = true;
      this.dragStart = { x: mouseX - this.panX, y: mouseY - this.panY };
    }
    
    this.draw();
  }

  handleMouseMove(e) {
    if (!this.img) return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const imgCoords = this.screenToImage(e.clientX, e.clientY);
    
    // Trigger coordinate display callback
    const rx = Math.round(imgCoords.x);
    const ry = Math.round(imgCoords.y);
    this.onMouseMoveCoords({ x: rx, y: ry });

    if (this.isDragging) {
      this.panX = mouseX - this.dragStart.x;
      this.panY = mouseY - this.dragStart.y;
      this.draw();
    } else if (this.activeMeasure) {
      this.activeMeasure.x2 = imgCoords.x;
      this.activeMeasure.y2 = imgCoords.y;
      this.draw();
    } else if (this.activeRoi) {
      this.activeRoi.w = imgCoords.x - this.activeRoi.x;
      this.activeRoi.h = imgCoords.y - this.activeRoi.y;
      this.draw();
    }
  }

  handleMouseUp(e) {
    if (this.isDragging) {
      this.isDragging = false;
    } 
    
    else if (this.activeMeasure) {
      // Calculate length in mm
      const dx = this.activeMeasure.x2 - this.activeMeasure.x1;
      const dy = this.activeMeasure.y2 - this.activeMeasure.y1;
      const pixelLength = Math.sqrt(dx * dx + dy * dy);
      
      if (pixelLength > 5) { // Minimum length to avoid accidental clicks
        const lengthMm = (pixelLength * this.calibrationMmPerPixel).toFixed(1);
        this.measurements.push({
          ...this.activeMeasure,
          label: `${lengthMm} mm`
        });
        this.onMeasurementAdded(lengthMm);
      }
      this.activeMeasure = null;
      this.draw();
    } 
    
    else if (this.activeRoi) {
      // Normalise bounding box (so w and h are positive)
      let x = this.activeRoi.x;
      let y = this.activeRoi.y;
      let w = this.activeRoi.w;
      let h = this.activeRoi.h;
      
      if (w < 0) { x += w; w = Math.abs(w); }
      if (h < 0) { y += h; h = Math.abs(h); }

      if (w > 10 && h > 10) {
        // Prompt for label
        setTimeout(() => {
          const label = prompt("Enter a label for this Region of Interest (ROI):", "Structural anomaly");
          if (label) {
            // Store coordinates as normalized coordinates (0..1) relative to image size
            const normBox = {
              x: x / this.img.width,
              y: y / this.img.height,
              w: w / this.img.width,
              h: h / this.img.height,
              label: label,
              confidence: 0.95 // Manual review boxes are 95% clinician confidence
            };
            this.boundingBoxes.push(normBox);
            this.onRoiAdded(normBox);
          }
          this.activeRoi = null;
          this.draw();
        }, 10);
      } else {
        this.activeRoi = null;
        this.draw();
      }
    }
  }

  handleWheel(e) {
    if (!this.img) return;
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse position to image position before zoom
    const imgX = (mouseX - this.panX) / this.zoom;
    const imgY = (mouseY - this.panY) / this.zoom;

    // Zoom multiplier
    const scale = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.zoom *= scale;

    // Clamp zoom between 10% and 1000%
    this.zoom = Math.max(0.1, Math.min(this.zoom, 10));

    // Calculate new pan positions so mouse pointer remains anchored
    this.panX = mouseX - imgX * this.zoom;
    this.panY = mouseY - imgY * this.zoom;

    this.updateViewportHud();
    this.draw();
  }

  draw() {
    // Clear canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.img) {
      // Draw placeholder text
      this.ctx.fillStyle = '#4a5568';
      this.ctx.font = '16px Inter';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('NO ACTIVE SCAN DETECTED', this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.font = '12px JetBrains Mono';
      this.ctx.fillText('Select a patient case or upload scan to initialize PACS node.', this.canvas.width / 2, this.canvas.height / 2 + 25);
      return;
    }

    // 1. Draw Image with adjustments (Brightness, Contrast, Inversion)
    this.ctx.save();
    // Apply filters *only* to the drawn image
    const filterStr = `brightness(${this.brightness}) contrast(${this.contrast}) invert(${this.invert ? 1 : 0})`;
    this.ctx.filter = filterStr;
    
    // Draw the image transformed by pan and zoom
    this.ctx.drawImage(
      this.img, 
      this.panX, 
      this.panY, 
      this.img.width * this.zoom, 
      this.img.height * this.zoom
    );
    this.ctx.restore();

    // 2. Draw Overlays in Image Coordinate Space
    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    // Image borders
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.lineWidth = 1 / this.zoom;
    this.ctx.strokeRect(0, 0, this.img.width, this.img.height);

    // Calibration grid (1 grid cell = 66.7px = 10mm)
    if (this.showGrid) {
      this.drawCalibrationGrid();
    }

    // AI Heatmap
    if (this.showHeatmap && this.heatmapPoints.length > 0) {
      this.drawHeatmap();
    }

    // Bounding Boxes / ROIs
    this.drawBoundingBoxes();

    // Active drawing items
    this.drawActiveDrawings();

    this.ctx.restore();
  }

  drawCalibrationGrid() {
    const step = 66.67; // approx 10 mm (assuming 1px = 0.15mm)
    this.ctx.strokeStyle = 'rgba(0, 210, 255, 0.15)';
    this.ctx.lineWidth = 0.5 / this.zoom;
    
    this.ctx.beginPath();
    // Vertical lines
    for (let x = step; x < this.img.width; x += step) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.img.height);
    }
    // Horizontal lines
    for (let y = step; y < this.img.height; y += step) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.img.width, y);
    }
    this.ctx.stroke();
  }

  drawHeatmap() {
    // Render Grad-CAM overlays using concentric radial gradients
    this.heatmapPoints.forEach(pt => {
      const pxX = pt.x * this.img.width;
      const pxY = pt.y * this.img.height;
      const radius = pt.r;
      
      const gradient = this.ctx.createRadialGradient(pxX, pxY, 0, pxX, pxY, radius);
      // Classic Jet color palette for heatmaps
      gradient.addColorStop(0, `rgba(239, 68, 68, ${0.45 * pt.v})`); // Red center
      gradient.addColorStop(0.25, `rgba(249, 115, 22, ${0.35 * pt.v})`); // Orange
      gradient.addColorStop(0.5, `rgba(234, 179, 8, ${0.2 * pt.v})`); // Yellow
      gradient.addColorStop(0.75, `rgba(59, 130, 246, ${0.08 * pt.v})`); // Blue
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(pxX, pxY, radius, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  drawBoundingBoxes() {
    this.boundingBoxes.forEach(box => {
      // Bounding box coordinates are stored normalized (0..1)
      const bx = box.x * this.img.width;
      const by = box.y * this.img.height;
      const bw = box.w * this.img.width;
      const bh = box.h * this.img.height;

      // Color scheme: Warning color for AI, neon blue for clinical manual boxes
      const isManual = box.confidence === 0.95;
      const color = isManual ? 'hsl(190, 100%, 50%)' : 'hsl(24, 90%, 55%)';
      const bgFill = isManual ? 'hsla(190, 100%, 50%, 0.05)' : 'hsla(24, 90%, 55%, 0.05)';

      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1.5 / this.zoom;
      this.ctx.fillStyle = bgFill;
      
      // Draw rectangle
      this.ctx.fillRect(bx, by, bw, bh);
      this.ctx.strokeRect(bx, by, bw, bh);

      // Draw label (scaled dynamically to retain constant screen size)
      this.ctx.fillStyle = color;
      const fontSize = Math.max(9, Math.min(13, 11 / this.zoom));
      this.ctx.font = `600 ${fontSize}px var(--font-mono)`;
      this.ctx.textAlign = 'left';
      
      const confPercent = Math.round(box.confidence * 100);
      const text = `${box.label.toUpperCase()} [${confPercent}%]`;
      this.ctx.fillText(text, bx + 4 / this.zoom, by + fontSize + 4 / this.zoom);
    });
  }

  drawActiveDrawings() {
    // Renders finalized measurements
    this.ctx.strokeStyle = 'hsl(190, 100%, 50%)';
    this.ctx.lineWidth = 1.5 / this.zoom;
    this.ctx.fillStyle = 'hsl(190, 100%, 50%)';

    this.measurements.forEach(m => {
      this.drawMeasurementLine(m.x1, m.y1, m.x2, m.y2, m.label);
    });

    // Renders active measurement line being drawn
    if (this.activeMeasure) {
      const dx = this.activeMeasure.x2 - this.activeMeasure.x1;
      const dy = this.activeMeasure.y2 - this.activeMeasure.y1;
      const mm = (Math.sqrt(dx*dx + dy*dy) * this.calibrationMmPerPixel).toFixed(1);
      
      this.ctx.strokeStyle = 'hsla(190, 100%, 50%, 0.7)';
      this.drawMeasurementLine(
        this.activeMeasure.x1, 
        this.activeMeasure.y1, 
        this.activeMeasure.x2, 
        this.activeMeasure.y2, 
        `${mm} mm`
      );
    }

    // Renders active ROI box being drawn
    if (this.activeRoi) {
      this.ctx.strokeStyle = 'hsla(190, 100%, 50%, 0.7)';
      this.ctx.lineWidth = 1.5 / this.zoom;
      this.ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
      this.ctx.strokeRect(
        this.activeRoi.x, 
        this.activeRoi.y, 
        this.activeRoi.w, 
        this.activeRoi.h
      );
      this.ctx.setLineDash([]); // Reset
    }
  }

  drawMeasurementLine(x1, y1, x2, y2, text) {
    const size = 6 / this.zoom;
    
    // Draw crosshair endpoints
    this.ctx.beginPath();
    // Point 1 cross
    this.ctx.moveTo(x1 - size, y1); this.ctx.lineTo(x1 + size, y1);
    this.ctx.moveTo(x1, y1 - size); this.ctx.lineTo(x1, y1 + size);
    // Point 2 cross
    this.ctx.moveTo(x2 - size, y2); this.ctx.lineTo(x2 + size, y2);
    this.ctx.moveTo(x2, y2 - size); this.ctx.lineTo(x2, y2 + size);
    this.ctx.stroke();

    // Draw connecting line
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    // Draw length text in the center
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    
    const fontSize = Math.max(9, Math.min(12, 10 / this.zoom));
    this.ctx.font = `${fontSize}px var(--font-mono)`;
    
    const textWidth = this.ctx.measureText(text).width;
    const paddingX = 4 / this.zoom;
    const paddingY = 2 / this.zoom;
    
    this.ctx.fillRect(
      cx - textWidth/2 - paddingX, 
      cy - fontSize/2 - paddingY, 
      textWidth + paddingX*2, 
      fontSize + paddingY*2
    );

    this.ctx.fillStyle = 'hsl(190, 100%, 50%)';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, cx, cy);
    this.ctx.restore();
  }
}
