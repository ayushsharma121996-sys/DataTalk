import os
import json
import pandas as pd
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

def train_ambiguity_model():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, 'dataset.csv')
    model_output_path = os.path.join(script_dir, 'ambiguity_model.joblib')
    metadata_output_path = os.path.join(script_dir, 'model_metadata.json')

    print(f"Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)

    X = df['text']
    y = df['label']

    # Create classification pipeline
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(ngram_range=(1, 2), lowercase=True)),
        ('clf', LogisticRegression(C=2.0, max_iter=200))
    ])

    # Train model on complete dataset
    pipeline.fit(X, y)

    # Evaluate train accuracy
    preds = pipeline.predict(X)
    acc = accuracy_score(y, preds)
    print(f"[OK] Model Training Completed. Training Accuracy: {acc * 100:.2f}%")

    # Export model artifact
    joblib.dump(pipeline, model_output_path)
    print(f"[OK] Saved model artifact to: {model_output_path}")

    # Export metadata
    metadata = {
        "model_name": "TFIDF_LogisticRegression_AmbiguityClassifier",
        "accuracy": round(acc * 100, 2),
        "total_samples": len(df),
        "labels": {0: "CLEAR", 1: "AMBIGUOUS"}
    }
    with open(metadata_output_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    print(f"[OK] Saved model metadata to: {metadata_output_path}")

if __name__ == '__main__':
    train_ambiguity_model()
