# patient_data.py

PATIENT_DATABASE = [
    {
        "id": "PX-84920",
        "name": "Eleanor Vance",
        "age": 64,
        "gender": "Female",
        "dob": "1962-04-12",
        "studyDate": "2026-06-20 09:15",
        "scanId": "S-4039",
        "modality": "CX",  # Chest X-Ray
        "imageUrl": "/assets/chest_xray.png",
        "diagnosisTitle": "Active Lobar Pneumonia",
        "diagnosisDetail": "Increased density and focal consolidation in the right lower lobe, highly consistent with active lobar pneumonia. The pleural spaces are intact with no effusion. Mediastinal structures are stable. Heart size is normal.",
        "confidence": 0.94,
        "status": "Awaiting Signature",
        "boundingBoxes": [
            {
                "x": 0.55,
                "y": 0.52,
                "w": 0.28,
                "h": 0.35,
                "label": "Lobar Opacity",
                "confidence": 0.94
            }
        ],
        "heatmap": [
            {"x": 0.69, "y": 0.69, "r": 120, "v": 1.0},
            {"x": 0.60, "y": 0.60, "r": 80, "v": 0.7}
        ],
        "recommendedSteps": "1. Initiate targeted antibiotic therapy (e.g., empiric broad-spectrum coverage).\n2. Obtain follow-up chest radiographs in 4-6 weeks to ensure complete resolution.\n3. Clinical correlation for fever, productive cough, and respiratory effort."
    },
    {
        "id": "PX-10293",
        "name": "Marcus Brody",
        "age": 42,
        "gender": "Male",
        "dob": "1984-11-23",
        "studyDate": "2026-06-25 14:30",
        "scanId": "S-5110",
        "modality": "MR",  # Brain MRI
        "imageUrl": "/assets/brain_mri.png",
        "diagnosisTitle": "Dural Meningioma Mass",
        "diagnosisDetail": "Well-circumscribed, extra-axial mass arising from the dura along the left parietal region, measuring approximately 2.4 cm in transverse diameter. Classic dural tail sign present. Mild surrounding vasogenic edema is noted.",
        "confidence": 0.89,
        "status": "Reviewed",
        "boundingBoxes": [
            {
                "x": 0.24,
                "y": 0.34,
                "w": 0.22,
                "h": 0.25,
                "label": "Extra-axial Mass",
                "confidence": 0.89
            }
        ],
        "heatmap": [
            {"x": 0.35, "y": 0.46, "r": 100, "v": 1.0},
            {"x": 0.32, "y": 0.42, "r": 70, "v": 0.8}
        ],
        "recommendedSteps": "1. Refer to neurosurgery for intervention consultation (resection vs. gamma knife vs. observation).\n2. Brain MRI with gadolinium contrast enhancement.\n3. Symptomatic management and monitoring for intracranial pressure elevation."
    },
    {
        "id": "PX-77201",
        "name": "Sarah Connor",
        "age": 35,
        "gender": "Female",
        "dob": "1991-08-05",
        "studyDate": "2026-06-27 11:05",
        "scanId": "S-9921",
        "modality": "XR",  # Knee X-Ray
        "imageUrl": "/assets/knee_xray.png",
        "diagnosisTitle": "Medial Joint Narrowing",
        "diagnosisDetail": "Mild narrowing of the medial joint compartment, indicative of early-stage joint degradation. Small osteophyte formation noted on the superior patella. No fractures, dislocations, or soft tissue swelling present.",
        "confidence": 0.82,
        "status": "Reviewed",
        "boundingBoxes": [
            {
                "x": 0.46,
                "y": 0.51,
                "w": 0.22,
                "h": 0.16,
                "label": "Medial Narrowing",
                "confidence": 0.82
            }
        ],
        "heatmap": [
            {"x": 0.57, "y": 0.59, "r": 80, "v": 1.0}
        ],
        "recommendedSteps": "1. Patient referral to physical therapy for lower extremity muscle strengthening.\n2. Weight management counseling and low-impact activity modifications.\n3. Over-the-counter NSAIDs for symptomatic management as needed."
    }
]
