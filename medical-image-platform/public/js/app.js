// app.js
import { PacsViewer } from './viewer-canvas.js';

// Global state
let patients = [];
let selectedPatient = null;
let currentViewer = null;

// DOM Elements
const patientListContainer = document.getElementById('patient-list-container');
const patientCountEl = document.getElementById('patient-count');
const patientSearchInput = document.getElementById('patient-search');
const filterChips = document.querySelectorAll('.filter-chips .chip');

// Toolbar Elements
const toolPanZoom = document.getElementById('tool-pan-zoom');
const toolMeasure = document.getElementById('tool-measure');
const toolDrawRoi = document.getElementById('tool-draw-roi');
const toolInvert = document.getElementById('tool-invert');
const toolGrid = document.getElementById('tool-grid');
const toolHeatmap = document.getElementById('tool-heatmap');
const toolReset = document.getElementById('tool-reset');
const sliderBrightness = document.getElementById('slider-brightness');
const sliderContrast = document.getElementById('slider-contrast');
const valBrightness = document.getElementById('val-brightness');
const valContrast = document.getElementById('val-contrast');

// HUD Elements
const hudPatientName = document.getElementById('hud-patient-name');
const hudPatientId = document.getElementById('hud-patient-id');
const hudPatientDob = document.getElementById('hud-patient-dob');
const hudScanModality = document.getElementById('hud-scan-modality');
const hudScanDate = document.getElementById('hud-scan-date');
const hudScanId = document.getElementById('hud-scan-id');
const hudCanvasZoom = document.getElementById('hud-canvas-zoom');
const hudCanvasDims = document.getElementById('hud-canvas-dims');
const hudCanvasWindow = document.getElementById('hud-canvas-window');
const hudMouseCoord = document.getElementById('hud-mouse-coord');

// AI and Findings Panel Elements
const btnRunAi = document.getElementById('btn-run-ai');
const scanningLaserLine = document.getElementById('scanning-laser-line');
const aiModelStatus = document.getElementById('ai-model-status');
const gaugePercent = document.getElementById('gauge-percent');
const gaugeCircle = document.getElementById('gauge-circle');
const aiFindingTitle = document.getElementById('ai-finding-title');
const aiFindingSubtitle = document.getElementById('ai-finding-subtitle');

// Findings Form Elements
const reportEditForm = document.getElementById('report-edit-form');
const reportTitle = document.getElementById('report-title');
const reportDetails = document.getElementById('report-details');
const reportRecommendations = document.getElementById('report-recommendations');
const reportStatus = document.getElementById('report-status');
const btnSaveReport = document.getElementById('btn-save-report');

// Dialog Elements
const uploadDialog = document.getElementById('upload-dialog');
const btnOpenUpload = document.getElementById('btn-open-upload');
const btnCloseUpload = document.getElementById('btn-close-upload');
const btnCancelUpload = document.getElementById('btn-cancel-upload');
const uploadScanForm = document.getElementById('upload-scan-form');

const reportDialog = document.getElementById('report-dialog');
const btnOpenReport = document.getElementById('btn-export-report');
const btnCloseReport = document.getElementById('btn-close-report');

// Initialise PACS Viewer
document.addEventListener('DOMContentLoaded', () => {
  initViewer();
  fetchPatients();
  bindUIEvents();
});

function initViewer() {
  currentViewer = new PacsViewer('pacs-canvas', {
    onViewportChange: (hudData) => {
      hudCanvasZoom.textContent = `ZOOM: ${hudData.zoom}%`;
      hudCanvasDims.textContent = `DIMS: ${hudData.dims}`;
      hudCanvasWindow.textContent = `W/L: ${hudData.window}`;
    },
    onMouseMoveCoords: (coords) => {
      hudMouseCoord.textContent = `X: ${coords.x} Y: ${coords.y}`;
    },
    onMeasurementAdded: (lengthMm) => {
      console.log(`Measurement added: ${lengthMm} mm`);
    },
    onRoiAdded: (box) => {
      // Sync manual box into our current patient object
      if (selectedPatient) {
        if (!selectedPatient.boundingBoxes) selectedPatient.boundingBoxes = [];
        selectedPatient.boundingBoxes.push(box);
      }
    }
  });
}

// Bind UI controls and interactions
function bindUIEvents() {
  // Search and Filters
  patientSearchInput.addEventListener('input', filterAndRenderPatients);
  filterChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      filterChips.forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
      filterAndRenderPatients();
    });
  });

  // Tools Selection
  toolPanZoom.addEventListener('click', () => selectTool('pan-zoom'));
  toolMeasure.addEventListener('click', () => selectTool('measure'));
  toolDrawRoi.addEventListener('click', () => selectTool('draw-roi'));

  // Sliders and filters
  sliderBrightness.addEventListener('input', (e) => {
    currentViewer.setBrightness(e.target.value);
    valBrightness.textContent = `${Math.round(e.target.value * 100)}%`;
  });
  sliderContrast.addEventListener('input', (e) => {
    currentViewer.setContrast(e.target.value);
    valContrast.textContent = `${Math.round(e.target.value * 100)}%`;
  });
  
  toolInvert.addEventListener('click', () => {
    const isCurrentlyInverted = toolInvert.classList.toggle('active');
    currentViewer.setInvert(isCurrentlyInverted);
  });

  toolGrid.addEventListener('click', () => {
    const isGridActive = toolGrid.classList.toggle('active');
    currentViewer.toggleGrid(isGridActive);
  });

  toolHeatmap.addEventListener('click', () => {
    const isHeatmapActive = toolHeatmap.classList.toggle('active');
    currentViewer.toggleHeatmap(isHeatmapActive);
  });

  toolReset.addEventListener('click', () => {
    currentViewer.resetView();
    // Reset buttons
    sliderBrightness.value = 1.0;
    sliderContrast.value = 1.0;
    valBrightness.textContent = "100%";
    valContrast.textContent = "100%";
    
    toolInvert.classList.remove('active');
    toolGrid.classList.remove('active');
    
    // Maintain heatmap if active
    if (selectedPatient && selectedPatient.heatmap && selectedPatient.heatmap.length > 0) {
      toolHeatmap.classList.add('active');
      currentViewer.toggleHeatmap(true);
    } else {
      toolHeatmap.classList.remove('active');
      currentViewer.toggleHeatmap(false);
    }
  });

  // Hotkeys helper (P, M, R, I, G, H, Esc)
  window.addEventListener('keydown', (e) => {
    // If inside input fields or textareas, skip hotkeys
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT') {
      return;
    }
    
    const key = e.key.toLowerCase();
    if (key === 'p') selectTool('pan-zoom');
    if (key === 'm') selectTool('measure');
    if (key === 'r') selectTool('draw-roi');
    if (key === 'i') toolInvert.click();
    if (key === 'g') toolGrid.click();
    if (key === 'h') toolHeatmap.click();
    if (key === 'escape') toolReset.click();
  });

  // AI Diagnostic triggers
  btnRunAi.addEventListener('click', runAiDiagnosticScan);

  // Form submits
  reportEditForm.addEventListener('submit', saveDiagnosticFindings);

  // Modal Open/Closes
  btnOpenUpload.addEventListener('click', () => uploadDialog.showModal());
  btnCloseUpload.addEventListener('click', () => uploadDialog.close());
  btnCancelUpload.addEventListener('click', () => uploadDialog.close());

  uploadScanForm.addEventListener('submit', uploadPatientScan);

  btnOpenReport.addEventListener('click', showPrintPreview);
  btnCloseReport.addEventListener('click', () => reportDialog.close());
}

// Select viewer tool pan/measure/draw
function selectTool(toolName) {
  toolPanZoom.classList.remove('active');
  toolMeasure.classList.remove('active');
  toolDrawRoi.classList.remove('active');

  if (toolName === 'pan-zoom') toolPanZoom.classList.add('active');
  else if (toolName === 'measure') toolMeasure.classList.add('active');
  else if (toolName === 'draw-roi') toolDrawRoi.classList.add('active');

  currentViewer.setTool(toolName);
}

// Fetch patients lists
async function fetchPatients(selectPatientId = null) {
  try {
    const res = await fetch('/api/patients');
    if (!res.ok) throw new Error("Failed to load patient records.");
    patients = await res.ok ? await res.json() : [];
    
    filterAndRenderPatients();

    if (patients.length > 0) {
      if (selectPatientId) {
        const found = patients.find(p => p.id === selectPatientId);
        if (found) selectPatient(found);
      } else {
        selectPatient(patients[0]);
      }
    }
  } catch (err) {
    console.error(err);
    patientListContainer.innerHTML = `<div class="list-placeholder error">Error: ${err.message}</div>`;
  }
}

// Filter and render sidebar
function filterAndRenderPatients() {
  const activeChip = document.querySelector('.filter-chips .chip.active');
  const modalityFilter = activeChip ? activeChip.getAttribute('data-modality') : 'ALL';
  const query = patientSearchInput.value.toLowerCase().trim();

  const filtered = patients.filter(p => {
    const matchesModality = modalityFilter === 'ALL' || p.modality === modalityFilter;
    const matchesQuery = !query || 
      p.name.toLowerCase().includes(query) || 
      p.id.toLowerCase().includes(query) ||
      p.modality.toLowerCase().includes(query);
    
    return matchesModality && matchesQuery;
  });

  patientCountEl.textContent = filtered.length;

  if (filtered.length === 0) {
    patientListContainer.innerHTML = '<div class="list-placeholder">No matching patient files.</div>';
    return;
  }

  patientListContainer.innerHTML = '';
  filtered.forEach(patient => {
    const card = document.createElement('div');
    card.className = `patient-card ${selectedPatient && selectedPatient.id === patient.id ? 'active' : ''}`;
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', selectedPatient && selectedPatient.id === patient.id ? 'true' : 'false');
    
    card.innerHTML = `
      <div class="card-header-line">
        <span class="patient-name">${patient.name}</span>
        <span class="scan-modality-badge">${patient.modality}</span>
      </div>
      <div class="card-meta-line">
        <span>ID: ${patient.id}</span>
        <span>Age/Sex: ${patient.age} / ${patient.gender[0]}</span>
      </div>
      <div class="card-bottom-line">
        <span class="scan-id">${patient.scanId}</span>
        <span class="status-tag ${getStatusClass(patient.status)}">${patient.status}</span>
      </div>
    `;

    card.addEventListener('click', () => selectPatient(patient));
    patientListContainer.appendChild(card);
  });
}

function getStatusClass(status) {
  if (status === 'Pending Analysis') return 'pending';
  if (status === 'Awaiting Signature') return 'awaiting';
  return 'reviewed';
}

// Select active patient
function selectPatient(patient) {
  selectedPatient = patient;
  
  // Highlight active card
  document.querySelectorAll('.patient-card').forEach(card => {
    card.classList.remove('active');
    card.setAttribute('aria-selected', 'false');
  });
  
  // Find card in UI and highlight
  const cards = patientListContainer.children;
  for (let card of cards) {
    if (card.querySelector('.patient-name').textContent === patient.name &&
        card.querySelector('.card-meta-line').textContent.includes(patient.id)) {
      card.classList.add('active');
      card.setAttribute('aria-selected', 'true');
    }
  }

  // Update HUD
  hudPatientName.textContent = `PATIENT: ${patient.name.toUpperCase()}`;
  hudPatientId.textContent = `ID: ${patient.id}`;
  hudPatientDob.textContent = `DOB: ${patient.dob}`;
  hudScanModality.textContent = `MODALITY: ${patient.modality}`;
  hudScanDate.textContent = `STUDY DATE: ${patient.studyDate}`;
  hudScanId.textContent = `SCAN ID: ${patient.scanId}`;

  // Reset Sliders
  sliderBrightness.value = 1.0;
  sliderContrast.value = 1.0;
  valBrightness.textContent = "100%";
  valContrast.textContent = "100%";
  toolInvert.classList.remove('active');
  toolGrid.classList.remove('active');

  // Load Image in Viewer
  currentViewer.setImage(patient.imageUrl, () => {
    // Apply bounding boxes and heatmaps
    currentViewer.boundingBoxes = [...(patient.boundingBoxes || [])];
    currentViewer.heatmapPoints = [...(patient.heatmap || [])];
    
    // Automatically enable heatmaps overlay if it is available
    if (patient.heatmap && patient.heatmap.length > 0) {
      toolHeatmap.classList.add('active');
      currentViewer.toggleHeatmap(true);
    } else {
      toolHeatmap.classList.remove('active');
      currentViewer.toggleHeatmap(false);
    }
  });

  // Populate Analysis metrics / forms
  updateAnalysisUI(patient);
}

function updateAnalysisUI(patient) {
  // Update AI Ring gauge and status
  if (patient.confidence > 0 && patient.diagnosisTitle !== "Unanalyzed Scan") {
    aiModelStatus.textContent = "ANALYSED";
    aiModelStatus.className = "badge badge-accent";
    
    const percent = Math.round(patient.confidence * 100);
    gaugePercent.textContent = `${percent}%`;
    
    // Animate progress circle SVG (radius=42, circumference=263.89)
    const circ = 263.89;
    const offset = circ - (percent / 100) * circ;
    gaugeCircle.style.strokeDashoffset = offset;
    
    aiFindingTitle.textContent = patient.diagnosisTitle;
    aiFindingSubtitle.textContent = `Modality scan analysis matched.`;
    
    btnRunAi.disabled = true;
    btnRunAi.textContent = "AI Analysis Complete";
  } else {
    aiModelStatus.textContent = "STANDBY";
    aiModelStatus.className = "badge";
    gaugePercent.textContent = "0%";
    gaugeCircle.style.strokeDashoffset = 263.89;
    
    aiFindingTitle.textContent = "Scan Pending";
    aiFindingSubtitle.textContent = "Run deep scan neural network.";
    
    btnRunAi.disabled = false;
    btnRunAi.innerHTML = `
      <svg class="icon-sparkles" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      Run AI Diagnostic Scan
    `;
  }

  // Populate Edit forms
  reportTitle.value = patient.diagnosisTitle !== "Unanalyzed Scan" ? patient.diagnosisTitle : "";
  reportDetails.value = patient.diagnosisTitle !== "Unanalyzed Scan" ? patient.diagnosisDetail : "";
  reportRecommendations.value = patient.diagnosisTitle !== "Unanalyzed Scan" ? patient.recommendedSteps : "";
  reportStatus.value = patient.status;
}

// Simulate AI Convolution Sweep and fetch analysis API
async function runAiDiagnosticScan() {
  if (!selectedPatient) return;

  // Show scan sweeps
  scanningLaserLine.style.display = "block";
  btnRunAi.disabled = true;
  btnRunAi.textContent = "Running Neural Analysis...";
  
  // Set UI state to Scanning
  aiModelStatus.textContent = "SCANNING";
  aiModelStatus.className = "badge badge-accent";
  aiFindingTitle.textContent = "Analyzing Layers...";
  aiFindingSubtitle.textContent = "Executing visual model checkpoints...";

  // 2.5 second simulation sweep
  setTimeout(async () => {
    try {
      const res = await fetch(`/api/patients/${selectedPatient.id}/analyze`, {
        method: "POST"
      });
      if (!res.ok) throw new Error("Failed to execute scan query.");
      const data = await res.json();
      
      if (data.status === "success") {
        // Update local patient structure
        const idx = patients.findIndex(p => p.id === selectedPatient.id);
        if (idx !== -1) {
          patients[idx] = data.patient;
          selectedPatient = data.patient;
        }
        
        // Redraw canvas with new annotations and heatmap
        currentViewer.boundingBoxes = [...(data.patient.boundingBoxes || [])];
        currentViewer.heatmapPoints = [...(data.patient.heatmap || [])];
        
        toolHeatmap.classList.add('active');
        currentViewer.toggleHeatmap(true);
        currentViewer.draw();

        // Refresh analysis components
        updateAnalysisUI(data.patient);
        filterAndRenderPatients();
      }
    } catch (err) {
      alert(`AI scanner failure: ${err.message}`);
      updateAnalysisUI(selectedPatient);
    } finally {
      scanningLaserLine.style.display = "none";
    }
  }, 2500);
}

// Submit Diagnostic Changes to API
async function saveDiagnosticFindings(e) {
  e.preventDefault();
  if (!selectedPatient) return;

  btnSaveReport.disabled = true;
  btnSaveReport.textContent = "Saving...";

  try {
    const response = await fetch(`/api/patients/${selectedPatient.id}/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        diagnosisTitle: reportTitle.value,
        diagnosisDetail: reportDetails.value,
        status: reportStatus.value,
        recommendedSteps: reportRecommendations.value,
        boundingBoxes: currentViewer.boundingBoxes // Sync any manually added ROIs
      })
    });

    if (!response.ok) throw new Error("Could not update clinical records.");
    const data = await response.json();

    if (data.status === "success") {
      // Update local db
      const idx = patients.findIndex(p => p.id === selectedPatient.id);
      if (idx !== -1) {
        patients[idx] = data.patient;
        selectedPatient = data.patient;
      }
      
      // Flash save confirmation message
      btnSaveReport.textContent = "Saved ✓";
      btnSaveReport.style.backgroundColor = "var(--color-success)";
      
      setTimeout(() => {
        btnSaveReport.disabled = false;
        btnSaveReport.textContent = "Save Findings";
        btnSaveReport.style.backgroundColor = "";
      }, 1500);

      filterAndRenderPatients();
    }
  } catch (err) {
    alert(`Save failed: ${err.message}`);
    btnSaveReport.disabled = false;
    btnSaveReport.textContent = "Save Findings";
  }
}

// Upload custom patient scan
async function uploadPatientScan(e) {
  e.preventDefault();
  
  const fileInput = document.getElementById('input-scan-file');
  const nameInput = document.getElementById('input-patient-name');
  const ageInput = document.getElementById('input-patient-age');
  const genderInput = document.getElementById('input-patient-gender');
  const dobInput = document.getElementById('input-patient-dob');
  const modalityInput = document.getElementById('input-scan-modality');

  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', nameInput.value);
  formData.append('age', ageInput.value);
  formData.append('gender', genderInput.value);
  formData.append('dob', dobInput.value);
  formData.append('modality', modalityInput.value);

  const btnSubmit = uploadScanForm.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.textContent = "Uploading & processing...";

  try {
    const res = await fetch('/api/upload', {
      method: "POST",
      body: formData
    });

    if (!res.ok) throw new Error("Upload failed on PACS repository.");
    const data = await res.json();

    if (data.status === "success") {
      uploadDialog.close();
      uploadScanForm.reset();
      
      // Reload and auto-select newly uploaded patient
      await fetchPatients(data.patient.id);
    }
  } catch (err) {
    alert(`Upload failure: ${err.message}`);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Process & Register Case";
  }
}

// Preview Report Modal
function showPrintPreview() {
  if (!selectedPatient) return;

  const p = selectedPatient;
  
  document.getElementById('rep-name').textContent = p.name;
  document.getElementById('rep-id').textContent = p.id;
  document.getElementById('rep-dob').textContent = p.dob;
  document.getElementById('rep-age-gender').textContent = `${p.age} / ${p.gender}`;
  document.getElementById('rep-modality').textContent = p.modality === 'CX' ? 'CX (Chest X-Ray)' : p.modality === 'MR' ? 'MR (Brain MRI)' : 'XR (Joint Radiography)';
  document.getElementById('rep-study-date').textContent = p.studyDate;
  document.getElementById('rep-scan-id').textContent = p.scanId;
  document.getElementById('rep-confidence').textContent = p.confidence > 0 ? `${Math.round(p.confidence * 100)}% Match` : 'N/A';
  
  document.getElementById('rep-summary').textContent = p.diagnosisTitle;
  document.getElementById('rep-details').textContent = p.diagnosisDetail;
  document.getElementById('rep-recommendations').textContent = p.recommendedSteps;
  
  const statusBadge = document.getElementById('rep-status');
  statusBadge.textContent = p.status.toUpperCase();
  statusBadge.className = `status-badge ${getStatusClass(p.status)}`;

  reportDialog.showModal();
}
