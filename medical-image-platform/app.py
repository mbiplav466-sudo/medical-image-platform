# app.py
import os
import shutil
import random
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from patient_data import PATIENT_DATABASE

app = FastAPI(title="Medical Image Diagnosis Platform API")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Ensure folders exist
os.makedirs(os.path.join(BASE_DIR, "uploads"), exist_ok=True)
os.makedirs(os.path.join(BASE_DIR, "public", "assets"), exist_ok=True)
os.makedirs(os.path.join(BASE_DIR, "public", "js"), exist_ok=True)

# In-memory database initialized from patient_data
patients_db = list(PATIENT_DATABASE)

class BoundingBox(BaseModel):
    x: float
    y: float
    w: float
    h: float
    label: str
    confidence: float

class HeatmapPoint(BaseModel):
    x: float
    y: float
    r: float
    v: float

class SavePatientRequest(BaseModel):
    diagnosisTitle: str
    diagnosisDetail: str
    status: str
    recommendedSteps: str
    boundingBoxes: Optional[List[BoundingBox]] = None

@app.get("/api/patients")
async def get_patients():
    return patients_db

@app.get("/api/patients/{patient_id}")
async def get_patient(patient_id: str):
    for patient in patients_db:
        if patient["id"] == patient_id:
            return patient
    raise HTTPException(status_code=404, detail="Patient not found")

@app.post("/api/patients/{patient_id}/save")
async def save_patient(patient_id: str, data: SavePatientRequest):
    for patient in patients_db:
        if patient["id"] == patient_id:
            patient["diagnosisTitle"] = data.diagnosisTitle
            patient["diagnosisDetail"] = data.diagnosisDetail
            patient["status"] = data.status
            patient["recommendedSteps"] = data.recommendedSteps
            if data.boundingBoxes is not None:
                patient["boundingBoxes"] = [box.model_dump() for box in data.boundingBoxes]
            return {"status": "success", "patient": patient}
    raise HTTPException(status_code=404, detail="Patient not found")

@app.post("/api/patients/{patient_id}/analyze")
async def analyze_patient(patient_id: str):
    # Simulate AI analysis for uploaded or existing patient scans
    for patient in patients_db:
        if patient["id"] == patient_id:
            # If already analyzed, just return it, otherwise run simulation
            if patient.get("confidence", 0) > 0 and patient.get("diagnosisTitle") != "Unanalyzed Scan":
                return {"status": "success", "patient": patient}
            
            # Simulate diagnosis detection
            filename = patient["imageUrl"].lower()
            if "chest" in filename or "cxr" in filename:
                modality = "CX"
                title = "Infiltration Detected"
                detail = "Simulated AI Analysis indicates minor focal infiltration in the left middle zone. Mild vascular congestion is present. Symmetrical expansion."
                bbox = [{"x": 0.22, "y": 0.45, "w": 0.25, "h": 0.30, "label": "Zone Infiltration", "confidence": 0.88}]
                heatmap = [{"x": 0.35, "y": 0.60, "r": 110, "v": 0.95}, {"x": 0.30, "y": 0.50, "r": 70, "v": 0.65}]
                steps = "1. Clinical follow-up with inflammatory blood markers.\n2. Repeat chest radiograph in 2-3 weeks to monitor progression.\n3. Keep patient hydrated; check spirometry."
            elif "brain" in filename or "mri" in filename:
                modality = "MR"
                title = "Vascular Hyperintensity"
                detail = "Simulated Brain MRI reveals a small region of focal white matter hyperintensity. Ventricles are of normal caliber for age. No significant mass effect."
                bbox = [{"x": 0.62, "y": 0.40, "w": 0.15, "h": 0.18, "label": "Focal Hyperintensity", "confidence": 0.81}]
                heatmap = [{"x": 0.70, "y": 0.49, "r": 80, "v": 0.90}]
                steps = "1. Correlate with cardiovascular risk factors (hypertension, smoking history).\n2. Follow-up imaging in 12 months for stability.\n3. Refer for neurological consultation."
            else:
                modality = patient.get("modality", "XR")
                title = "Soft Tissue Swelling"
                detail = "Radiograph demonstrates local soft tissue swelling. Underlying bony cortex appears normal and intact. No acute cortical disruption detected."
                bbox = [{"x": 0.45, "y": 0.45, "w": 0.20, "h": 0.20, "label": "Localized Swelling", "confidence": 0.78}]
                heatmap = [{"x": 0.55, "y": 0.55, "r": 90, "v": 0.85}]
                steps = "1. Apply cold compress and evaluate for localized trauma.\n2. Consider short-term rest and joint stabilization.\n3. Clinical review if swelling persists past 72 hours."

            patient["modality"] = modality
            patient["diagnosisTitle"] = title
            patient["diagnosisDetail"] = detail
            patient["confidence"] = round(random.uniform(0.75, 0.96), 2)
            patient["boundingBoxes"] = bbox
            patient["heatmap"] = heatmap
            patient["recommendedSteps"] = steps
            patient["status"] = "Awaiting Signature"
            return {"status": "success", "patient": patient}
            
    raise HTTPException(status_code=404, detail="Patient not found")

@app.post("/api/upload")
async def upload_scan(
    file: UploadFile = File(...),
    name: str = Form(...),
    age: int = Form(...),
    gender: str = Form(...),
    dob: str = Form(...),
    modality: str = Form(...)
):
    try:
        # Create a safe filename
        original_filename = file.filename or "upload"
        sanitized_filename = os.path.basename(original_filename).replace(" ", "_")
        safe_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{sanitized_filename}"
        file_path = os.path.join(BASE_DIR, "uploads", safe_filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Register new patient
        new_id = f"PX-{random.randint(10000, 99999)}"
        new_patient = {
            "id": new_id,
            "name": name,
            "age": age,
            "gender": gender,
            "dob": dob,
            "studyDate": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "scanId": f"S-{random.randint(1000, 9999)}",
            "modality": modality,
            "imageUrl": f"/uploads/{safe_filename}",
            "diagnosisTitle": "Unanalyzed Scan",
            "diagnosisDetail": "Awaiting clinical review and AI diagnosis scan execution. Click 'Run AI Scan' in the right-side control panel to execute analytics.",
            "confidence": 0.0,
            "status": "Pending Analysis",
            "boundingBoxes": [],
            "heatmap": [],
            "recommendedSteps": "N/A - Analysis pending."
        }
        patients_db.insert(0, new_patient)  # Prepend to list
        return {"status": "success", "patient": new_patient}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload scan: {str(e)}")

# Serve Static Frontend Files
@app.get("/")
async def get_index():
    return FileResponse(os.path.join(BASE_DIR, "public", "index.html"))

@app.get("/index.css")
async def get_css():
    return FileResponse(os.path.join(BASE_DIR, "public", "index.css"))

# Mount Assets, JS components, and uploads folder
app.mount("/assets", StaticFiles(directory=os.path.join(BASE_DIR, "public", "assets")), name="assets")
app.mount("/js", StaticFiles(directory=os.path.join(BASE_DIR, "public", "js")), name="js")
app.mount("/uploads", StaticFiles(directory=os.path.join(BASE_DIR, "uploads")), name="uploads")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=3000, reload=True)
