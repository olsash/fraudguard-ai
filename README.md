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

## Machine Learning Setup

Create and activate a Python virtual environment from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r ml\requirements.txt
```

Train the production model artifacts:

```powershell
python ml\train_model.py
```

This reads `ml/dataset/fraud.csv` and writes:

```text
ml/models/fraud_model.pkl
ml/models/columns.pkl
```

The FastAPI ML service requires both files. If they are missing, run the training script first.

## ML Notebook Execution

The notebook is used for exploratory machine learning experiments and model evaluation.

1. Ensure the dataset exists at `ml/dataset/fraud.csv`.
2. Activate the Python virtual environment.
3. Install notebook tooling if needed:

```powershell
pip install notebook
```

4. Start Jupyter:

```powershell
jupyter notebook
```

5. Open:

```text
ml/notebooks/fraud_detection_ml_experiments.ipynb
```

The notebook references the dataset through `../dataset/fraud.csv`, so run it from the `ml/notebooks` location or keep the notebook path unchanged.

## ML API Startup

Start the FastAPI prediction service after training the model:

```powershell
uvicorn ml.api.app:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```text
http://localhost:8000/health
```

Prediction endpoint:

```text
POST http://localhost:8000/predict
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
2. Install Python dependencies and train the model:

```powershell
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
