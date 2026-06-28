# FraudGuard-AI

FraudGuard-AI is a full-stack machine learning project for online payment fraud detection. It uses a fraud transaction dataset, trains and compares several classifiers, exposes fraud prediction through a Python FastAPI service, and provides a React/Vite web application backed by an ASP.NET Core Web API.

The project is intended for both implementation review and academic evaluation. It includes the machine learning notebook, trained model artifacts, exported evaluation results, backend APIs, frontend dashboards, admin review pages, and project documentation.

## Project Overview

FraudGuard-AI helps identify suspicious online payment transactions by analyzing transaction type, amount, and account balance changes before and after a transaction. Fraud detection is useful because fraudulent payments are usually rare, expensive, and difficult to review manually at scale.

Machine learning is used as a binary classification approach. The target variable is `isFraud`, where the model learns patterns that separate legitimate and fraudulent transactions. The project also includes clustering with KMeans and PCA visualization to explore whether transactions form natural groups without using the fraud label during clustering.

The implemented system supports:

- User authentication and role-based access.
- Transaction creation and fraud prediction.
- Prediction history.
- Admin dashboard and admin review pages.
- Model comparison from exported ML results.
- Reports and visualizations.
- Fraud alerts where supported by the backend/frontend workflow.

## Prerequisites

Install these tools before running the full project:

- Python 3.10 or newer
- Node.js 20 or newer
- .NET SDK 10, matching the backend `net10.0` target
- SQL Server LocalDB, SQL Server Developer Edition, or another SQL Server instance
- Jupyter Notebook, installed through `ml/requirements.txt`
- Entity Framework Core CLI support for `dotnet ef database update`

## Repository Structure

```text
fraudguard-ai/
|-- backend/
|   `-- FraudGuard.Api/
|       |-- Controllers/          # ASP.NET Core API controllers
|       |-- Data/                 # Entity Framework Core DbContext
|       |-- DTOs/                 # Request and response DTOs
|       |-- Migrations/           # EF Core database migrations
|       |-- Models/               # Database entities
|       |-- Services/             # JWT, logs, and ML API integration services
|       |-- appsettings.json      # Backend configuration
|       `-- FraudGuard.Api.csproj # ASP.NET Core Web API project
|-- frontend/
|   |-- src/
|   |   |-- components/           # Shared UI and layout components
|   |   |-- config/               # Frontend API configuration
|   |   |-- data/                 # Static visualization/reference data
|   |   |-- pages/                # User, admin, reports, auth, and workflow pages
|   |   |-- routes/               # TanStack Router routes
|   |   |-- services/             # Frontend API clients
|   |   `-- types/                # TypeScript domain/API types
|   |-- package.json
|   `-- vite.config.ts
|-- ml/
|   |-- api/
|   |   `-- app.py                # Python FastAPI prediction service
|   |-- dataset/
|   |   `-- fraud.csv             # Fraud transaction dataset
|   |-- models/                   # Trained model artifacts
|   |-- notebooks/
|   |   `-- fraud_detection_ml_experiments.ipynb
|   |-- results/                  # Exported metrics, plots, and model comparison files
|   |-- requirements.txt
|   |-- train_model.py
|   `-- validate_notebook_outputs.py
|-- docs/
|   `-- fraudguard-ai-ml-report.md
|-- retrain_models.py
`-- README.md
```

Main folders:

- `backend`: ASP.NET Core Web API for authentication, users, transactions, predictions, alerts, settings, logs, admin workflows, and integration with the ML API.
- `frontend`: React/Vite application for the user workspace, admin dashboard, prediction pages, model comparison, reports, alerts, and settings.
- `ml`: Python machine learning workspace, including preprocessing, training, FastAPI prediction service, notebook, model artifacts, and result exports.
- `ml/notebooks`: Academic ML experiment notebook.
- `ml/models`: Saved trained models, feature columns, scaler, and metadata.
- `ml/results`: Exported metrics and visualizations used by reports and admin model comparison pages.
- `docs`: Academic documentation, including the ML project report.

## Dataset

The dataset exists in the repository at:

```text
ml/dataset/fraud.csv
```

This dataset is used for model training, evaluation, feature selection, clustering experiments, and result exports. The main target column is:

```text
isFraud
```

The primary modeling features used by the notebook and training workflow are:

- `type`
- `amount`
- `oldbalanceOrg`
- `newbalanceOrig`
- `oldbalanceDest`
- `newbalanceDest`
- `isFraud`

Do not remove or rename `ml/dataset/fraud.csv`. The notebook, training scripts, validation script, and ML API workflow rely on this path.

## Machine Learning Workflow

The main academic workflow is implemented in:

```text
ml/notebooks/fraud_detection_ml_experiments.ipynb
```

The workflow includes:

- Dataset loading from `ml/dataset/fraud.csv`.
- Data exploration and class distribution review.
- Preprocessing of numeric and categorical transaction features.
- One-hot encoding for transaction type.
- Feature scaling where required by the model.
- Stratified train/test split for reproducible evaluation.
- Class imbalance handling using class-weighted classifiers where supported.
- Feature selection with `SelectKBest`.
- Classification with:
  - Logistic Regression
  - K-Nearest Neighbors
  - Decision Tree
  - Random Forest
  - Neural Network / `MLPClassifier`
- Hyperparameter tuning with `GridSearchCV`.
- Evaluation with accuracy, precision, recall, F1-score, ROC-AUC, and confusion matrices.
- Neural network architecture comparison.
- KMeans clustering.
- PCA visualization for clustering results.
- Export of model comparison results, confusion matrices, feature importance, clustering results, PCA plots, and model artifacts.

Important result and artifact paths:

```text
ml/models/best_model.pkl
ml/models/fraud_model.pkl
ml/models/columns.pkl
ml/models/scaler.pkl
ml/models/training_metadata.json
ml/results/model_comparison_results.json
ml/results/model_comparison_results.csv
ml/results/confusion_matrices.json
ml/results/confusion_matrices.csv
ml/results/feature_importance_results.json
ml/results/feature_importance_results.csv
ml/results/clustering_results.json
ml/results/clustering_results.csv
ml/results/kmeans_pca_clusters.png
ml/results/kmeans_pca_true_labels.png
```

The academic ML report is available at:

```text
docs/fraudguard-ai-ml-report.md
```

## Run the ML Notebook

Run these commands from the repository root.

### 1. Create a Python Environment

PowerShell on Windows:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

If PowerShell blocks script activation:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\.venv\Scripts\Activate.ps1
```

macOS or Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

### 2. Install ML Dependencies

```powershell
pip install -r ml\requirements.txt
```

macOS or Linux:

```bash
pip install -r ml/requirements.txt
```

### 3. Open Jupyter Notebook

```powershell
jupyter notebook
```

Open this notebook:

```text
ml/notebooks/fraud_detection_ml_experiments.ipynb
```

Run the notebook from the first cell to the last cell. It should load `ml/dataset/fraud.csv`, train/evaluate the models, generate plots, save outputs, and leave the notebook with visible outputs for academic review.

Optional validation after running the notebook:

```powershell
python ml\validate_notebook_outputs.py
```

## Run the Production Training Script

The notebook is the main academic experiment file. The project also includes a retraining entry point:

```powershell
python retrain_models.py
```

This command reads `ml/dataset/fraud.csv` and writes model artifacts and result files under `ml/models` and `ml/results`.

## Run the ML API

The ML API exists at:

```text
ml/api/app.py
```

Start the FastAPI prediction service from the repository root after model artifacts exist:

```powershell
uvicorn ml.api.app:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```text
GET http://localhost:8000/health
```

Prediction endpoint:

```text
POST http://localhost:8000/predict
```

Smoke test:

```powershell
python ml\smoke_test_prediction_api.py
```

Use a custom base URL if needed:

```powershell
python ml\smoke_test_prediction_api.py --base-url http://127.0.0.1:8000
```

## Run the Backend

The ASP.NET Core backend project is located at:

```text
backend/FraudGuard.Api
```

The backend uses Entity Framework Core with SQL Server. The default connection string is in:

```text
backend/FraudGuard.Api/appsettings.json
```

From the repository root:

```powershell
cd backend\FraudGuard.Api
dotnet restore
dotnet ef database update
dotnet run
```

The backend runs at:

```text
http://localhost:5000
```

API routes are available under:

```text
http://localhost:5000/api
```

Default development accounts:

- `admin@credit.com` / `admin123`
- `user@credit.com` / `user123`

The backend is configured to call the ML API at `http://localhost:8000`.

## Run the Frontend

The React/Vite frontend is located at:

```text
frontend
```

From the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Vite prints the local development URL in the terminal. The backend CORS policy allows:

```text
http://localhost:5173
http://localhost:8080
```

By default, the frontend calls:

```text
http://localhost:5000/api
```

Optional environment overrides:

```powershell
$env:VITE_API_BASE_URL="http://localhost:5000/api"
$env:VITE_ML_PREDICTION_API_URL="http://localhost:5000/api/predictions"
npm run dev
```

## Recommended Run Order

Use separate terminals:

1. Prepare Python dependencies and model artifacts:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r ml\requirements.txt
python retrain_models.py
```

2. Start the ML API:

```powershell
uvicorn ml.api.app:app --reload --host 127.0.0.1 --port 8000
```

3. Start the backend:

```powershell
cd backend\FraudGuard.Api
dotnet ef database update
dotnet run
```

4. Start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

5. Open the frontend URL printed by Vite and sign in with a development account.

## Academic Requirements Checklist

- [x] Real dataset at `ml/dataset/fraud.csv`
- [x] Target column `isFraud`
- [x] Five classifiers
- [x] Logistic Regression
- [x] KNN
- [x] Decision Tree
- [x] Random Forest
- [x] Neural Network / `MLPClassifier`
- [x] Hyperparameter tuning with `GridSearchCV`
- [x] Feature selection with `SelectKBest`
- [x] Train/test split
- [x] Evaluation metrics: accuracy, precision, recall, F1-score, ROC-AUC
- [x] Confusion matrices
- [x] Model comparison exports
- [x] KMeans clustering
- [x] PCA visualization
- [x] Saved model artifacts
- [x] Documentation in `docs/fraudguard-ai-ml-report.md`
- [x] Executable notebook workflow
- [x] Full-stack application for prediction, history, admin review, reports, alerts, and model comparison

## Troubleshooting

### Python packages are missing

Activate the virtual environment and reinstall the ML requirements:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r ml\requirements.txt
```

### Jupyter does not open

Confirm the environment is active and `jupyter` is installed from `ml/requirements.txt`:

```powershell
jupyter notebook
```

### Dataset path errors

Confirm the dataset is still located at:

```text
ml/dataset/fraud.csv
```

Do not rename the file or move it to another folder.

### Model artifacts are not found

Regenerate artifacts:

```powershell
python retrain_models.py
```

Then verify expected notebook outputs if you ran the notebook:

```powershell
python ml\validate_notebook_outputs.py
```

### ML API returns a model artifact error

Start the FastAPI service only after model artifacts exist:

```powershell
uvicorn ml.api.app:app --reload --host 127.0.0.1 --port 8000
```

If artifacts are missing, run:

```powershell
python retrain_models.py
```

### Backend database connection fails

Check the SQL Server connection string in:

```text
backend/FraudGuard.Api/appsettings.json
```

Then run migrations from the backend folder:

```powershell
cd backend\FraudGuard.Api
dotnet ef database update
```

### Backend cannot reach the ML API

Make sure the FastAPI service is running at:

```text
http://localhost:8000
```

### Frontend cannot reach the backend

Confirm the backend is running at:

```text
http://localhost:5000
```

If needed, set the frontend API URL before starting Vite:

```powershell
cd frontend
$env:VITE_API_BASE_URL="http://localhost:5000/api"
npm run dev
```

### Frontend dependencies are missing

Install dependencies from the frontend folder:

```powershell
cd frontend
npm install
```

## Useful Validation Commands

Validate notebook outputs:

```powershell
python ml\validate_notebook_outputs.py
```

Build the frontend:

```powershell
cd frontend
npm run build
```

Build the backend:

```powershell
cd backend\FraudGuard.Api
dotnet build
```
