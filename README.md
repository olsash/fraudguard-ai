# FraudGuard AI

FraudGuard AI is a full-stack fraud detection project for analyzing payment transactions, flagging suspicious activity, and exposing model-backed fraud risk predictions through a web application.

The project is split into three main parts:

- A Python machine learning workspace for dataset exploration, model training, and prediction serving.
- A .NET backend API for authentication, users, transactions, predictions, alerts, reports, and admin workflows.
- A React/Vite frontend for the user and admin dashboards.

## Folder Structure

```text
fraudguard-ai/
|-- backend/
|   `-- FraudGuard.Api/
|       |-- Controllers/          # REST API controllers
|       |-- Data/                 # Entity Framework DbContext
|       |-- DTOs/                 # API request/response models
|       |-- Migrations/           # EF Core database migrations
|       |-- Models/               # Database entities
|       |-- Services/             # JWT, logging, and ML API integration
|       |-- appsettings.json      # API configuration
|       `-- FraudGuard.Api.csproj # .NET backend project
|-- frontend/
|   |-- src/
|   |   |-- components/           # Shared UI and layout components
|   |   |-- config/               # Frontend API URL configuration
|   |   |-- pages/                # Dashboard, auth, admin, and workflow pages
|   |   |-- routes/               # TanStack Router routes
|   |   |-- services/             # API clients
|   |   `-- types/                # TypeScript API/domain types
|   |-- package.json
|   `-- vite.config.ts
|-- ml/
|   |-- api/
|   |   `-- app.py                # FastAPI prediction service
|   |-- dataset/
|   |   `-- fraud.csv             # Local dataset only; do not commit
|   |-- models/
|   |   |-- columns.pkl           # Trained feature columns
|   |   `-- fraud_model.pkl       # Trained model artifact
|   |-- notebooks/
|   |   `-- fraud_detection_ml_experiments.ipynb
|   |-- results/
|   |   `-- model_comparison_results.json
|   |-- requirements.txt
|   `-- train_model.py            # Reproducible training script
|-- .gitignore
`-- README.md
```

## Prerequisites

Install these tools before running the project locally:

- Python 3.10 or newer
- Node.js 20 or newer
- .NET SDK 10
- SQL Server LocalDB, SQL Server Developer Edition, or another SQL Server instance
- Jupyter Notebook or JupyterLab, if you want to run the ML notebook

## Dataset Setup

The fraud dataset is intentionally not committed to the repository. The `.gitignore` file excludes CSV files and the `ml/dataset/` folder so the full dataset does not enter Git history.

Place the dataset here:

```text
ml/dataset/fraud.csv
```

From the repository root:

```powershell
mkdir ml\dataset
Copy-Item C:\path\to\your\fraud.csv ml\dataset\fraud.csv
```

The training script expects these columns:

- `type`
- `amount`
- `oldbalanceOrg`
- `newbalanceOrig`
- `oldbalanceDest`
- `newbalanceDest`
- `isFraud`

Do not force-add the dataset. Keep `ml/dataset/fraud.csv` local only.

## Machine Learning Project Execution

Run all ML commands from the repository root unless a step says otherwise. The ML workflow has four parts:

1. Create a Python virtual environment.
2. Install `ml/requirements.txt`.
3. Open and run the notebook for experiments.
4. Train the production model and start the FastAPI prediction API.

### 1. Create and Activate a Virtual Environment

Create a local Python virtual environment from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

If PowerShell blocks activation, allow scripts for the current user and activate again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\.venv\Scripts\Activate.ps1
```

On macOS or Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

### 2. Install ML Dependencies

Install the ML requirements:

```powershell
pip install -r ml\requirements.txt
```

The requirements include the libraries needed for the notebook, model training, and prediction API, including pandas, NumPy, scikit-learn, matplotlib, SHAP, Jupyter, FastAPI, Uvicorn, Pydantic, and joblib.

### 3. Open and Run the ML Notebook

The notebook is used for data exploration, class imbalance analysis, model comparison, feature selection, hyperparameter tuning, clustering, explainability, and evaluation plots.

Before opening it, make sure the full dataset exists at:

```text
ml/dataset/fraud.csv
```

Then start Jupyter:

```powershell
jupyter notebook
```

Open:

```text
ml/notebooks/fraud_detection_ml_experiments.ipynb
```

Run the notebook cells from top to bottom. The notebook checks for `ml/dataset/fraud.csv` before loading data and prints a clear error if the dataset is missing.

You can also use JupyterLab if preferred:

```powershell
jupyter lab
```

### 4. Train the Production ML Model

The notebook is for experiments. The production prediction API uses the model artifacts generated by `ml/train_model.py`.

Train the model from the repository root:

```powershell
python ml\train_model.py
```

This reads `ml/dataset/fraud.csv` and writes:

```text
ml/models/fraud_model.pkl
ml/models/columns.pkl
ml/models/training_metadata.json
```

The training script prints accuracy, precision, recall, F1-score, and ROC-AUC. It also saves dataset metadata and model parameters to `ml/models/training_metadata.json` for reproducibility.

If training fails with a dataset error, confirm that the full dataset is placed at:

```text
ml/dataset/fraud.csv
```

Do not commit the full dataset. It is intentionally ignored by Git.

### Model Comparison Results

FraudGuard AI evaluates multiple classifiers for fraud detection before selecting the model used by the application. The tested classifiers include:

- Logistic Regression
- KNN
- Decision Tree
- Random Forest
- Neural Network

The full technical experiments are available in:

```text
ml/notebooks/fraud_detection_ml_experiments.ipynb
```

The final comparison results displayed in the web application are stored in:

```text
ml/results/model_comparison_results.json
```

The Admin Model Comparison page displays these exported results inside the web application. It is informational only: admins can review metrics and hyperparameters, but the page does not retrain models or switch the production model from the UI.

The best model is selected from the notebook results using evaluation metrics such as F1 Score, Recall, Precision, Accuracy, and Confusion Matrix. To view the page in the app, sign in as an admin and open:

```text
Admin Dashboard -> Model Comparison
```

### 5. Start the ML Prediction API

Start the FastAPI prediction service after the model has been trained:

```powershell
uvicorn ml.api.app:app --reload --host 127.0.0.1 --port 8000
```

The API loads:

```text
ml/models/fraud_model.pkl
ml/models/columns.pkl
```

Health check:

```text
GET http://localhost:8000/health
```

Prediction endpoint:

```text
POST http://localhost:8000/predict
```

Example prediction request:

```json
{
  "transactionType": "TRANSFER",
  "amount": 250000,
  "oldBalanceOrigin": 300000,
  "newBalanceOrigin": 50000,
  "oldBalanceDestination": 0,
  "newBalanceDestination": 250000
}
```

If the API returns `503 Model artifacts are not available`, run:

```powershell
python ml\train_model.py
```

The .NET backend is configured to call this service at `http://localhost:8000`.

## Backend Startup

The backend project is in `backend/FraudGuard.Api`.

The default connection string in `backend/FraudGuard.Api/appsettings.json` is:

```text
Server=localhost;Database=FraudGuardDb;Trusted_Connection=True;TrustServerCertificate=True;Encrypt=False;
```

Update it if your SQL Server instance uses a different host, instance name, or authentication method.

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

Default development accounts:

- `admin@credit.com` / `admin123`
- `user@credit.com` / `user123`

The backend exposes API routes under:

```text
http://localhost:5000/api
```

## Frontend Startup

The frontend project is in `frontend`.

From the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Vite will print the local development URL. The backend CORS policy allows:

```text
http://localhost:5173
http://localhost:8080
```

By default, the frontend calls:

```text
http://localhost:5000/api
```

You can override the API URLs with environment variables:

```powershell
$env:VITE_API_BASE_URL="http://localhost:5000/api"
$env:VITE_ML_PREDICTION_API_URL="http://localhost:5000/api/predictions"
npm run dev
```

## Recommended Local Run Order

Use separate terminals:

1. Prepare the dataset at `ml/dataset/fraud.csv`.
2. Create the Python virtual environment, install ML dependencies, and train the model:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r ml\requirements.txt
python ml\train_model.py
```

3. Start the ML API:

```powershell
uvicorn ml.api.app:app --reload --host 127.0.0.1 --port 8000
```

4. Start the backend:

```powershell
cd backend\FraudGuard.Api
dotnet ef database update
dotnet run
```

5. Start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Then open the frontend development URL and sign in with one of the default development accounts.

## Notes

- Keep the dataset out of Git. The repository is configured to ignore `ml/dataset/` and `*.csv`.
- Re-run `python ml\train_model.py` after changing the dataset or model features.
- Keep the ML API running while using fraud prediction workflows in the backend or frontend.
- If backend predictions fail with a service unavailable message, check that `uvicorn` is running on port `8000` and that `ml/models/fraud_model.pkl` and `ml/models/columns.pkl` exist.
