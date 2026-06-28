# Dataset Files

FraudGuard-AI uses the fraud transaction dataset stored at `ml/dataset/fraud.csv`.

## Full Dataset

The complete dataset must remain available at:

```text
ml/dataset/fraud.csv
```

The retraining command reads this file:

```powershell
python retrain_models.py
```

Do not remove or rename `fraud.csv`. The notebook, retraining script, and FastAPI artifact workflow expect this exact path.

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

Use `fraud_sample.csv` only for lightweight local checks or temporary notebook experiments. The production training script expects `fraud.csv`, so keep the full dataset in place for the real project workflow.

Keep `fraud_sample.csv` small enough to review and store in Git if you decide to commit it.
