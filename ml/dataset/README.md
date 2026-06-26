# Dataset Files

The full `fraud.csv` dataset is not committed to this repository because it is too large for normal source control and should remain a local development asset.

## Full Dataset

Place the complete dataset at:

```text
ml/dataset/fraud.csv
```

From the repository root on Windows:

```powershell
Copy-Item C:\path\to\your\fraud.csv ml\dataset\fraud.csv
```

The retraining command reads this file:

```powershell
python retrain_models.py
```

Do not commit `fraud.csv` or force-add it with Git. The root `.gitignore` keeps the full dataset ignored.

## Optional Small Test Dataset

For quick local checks, you can add a small sampled file:

```text
ml/dataset/fraud_sample.csv
```

This sample should contain the same columns as the full dataset:

- `type`
- `amount`
- `oldbalanceOrg`
- `newbalanceOrig`
- `oldbalanceDest`
- `newbalanceDest`
- `isFraud`

Use `fraud_sample.csv` only for lightweight testing, demos, or notebook experiments. The production training script currently expects `fraud.csv`, so either copy the sample to `fraud.csv` temporarily for a quick run or update your local experiment code to read `fraud_sample.csv`.

Keep `fraud_sample.csv` small enough to review and store in Git if you decide to commit it.
