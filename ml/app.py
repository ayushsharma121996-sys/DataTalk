import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib

app = FastAPI(
    title="SQL_text_AL ML Ambiguity Classifier API",
    description="Machine Learning service to predict user query ambiguity for Text-to-SQL translation",
    version="1.0.0"
)

script_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(script_dir, 'ambiguity_model.joblib')
metadata_path = os.path.join(script_dir, 'model_metadata.json')

model = None
metadata = {}

if os.path.exists(model_path):
    try:
        model = joblib.load(model_path)
        print(f"[OK] Loaded trained ML model from {model_path}")
    except Exception as e:
        print(f"[ERROR] Failed to load ML model: {e}")

if os.path.exists(metadata_path):
    with open(metadata_path, 'r', encoding='utf-8') as f:
        metadata = json.load(f)

class PredictRequest(BaseModel):
    question: str

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "model_loaded": model is not None,
        "metadata": metadata
    }

@app.post("/predict")
def predict_ambiguity(req: PredictRequest):
    if not req.question or not isinstance(req.question, str):
        raise HTTPException(status_code=400, detail="Question string is required")

    question = req.question.strip()

    # Rule override for explicitly clarified queries
    has_explicit = any(phrase in question.lower() for phrase in [
        'by revenue', 'by order count', 'by total revenue', 'by units sold', 'by repeat visits', 'last 30 days', 'august 2026'
    ])
    if has_explicit:
        return {
            "question": question,
            "is_ambiguous": False,
            "label": "CLEAR",
            "confidence_score": 99.0,
            "reason": "Explicit intent criteria specified in query prompt."
        }

    if model is not None:
        try:
            prediction = int(model.predict([question])[0])
            probs = model.predict_proba([question])[0]
            confidence = round(float(probs[prediction]) * 100, 2)
            is_ambiguous = bool(prediction == 1)
            
            return {
                "question": question,
                "is_ambiguous": is_ambiguous,
                "label": "AMBIGUOUS" if is_ambiguous else "CLEAR",
                "confidence_score": confidence,
                "model_name": metadata.get("model_name", "TFIDF_LogisticRegression")
            }
        except Exception as e:
            print(f"Prediction error: {e}")

    # Heuristic fallback if model load failed
    ambiguous_keywords = ['best customer', 'top customer', 'top product', 'best product', 'recent orders', 'new customers', 'inactive']
    is_ambiguous_fallback = any(k in question.lower() for k in ambiguous_keywords)
    
    return {
        "question": question,
        "is_ambiguous": is_ambiguous_fallback,
        "label": "AMBIGUOUS" if is_ambiguous_fallback else "CLEAR",
        "confidence_score": 90.0,
        "model_name": "Heuristic_Fallback"
    }

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
