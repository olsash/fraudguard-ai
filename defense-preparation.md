# FraudGuard AI Defense Preparation

This document contains likely presentation and defense questions with concise answers based on the FraudGuard AI machine learning workflow.

## Dataset Selection

### Why did you choose this dataset?

The project uses a PaySim-style online payment fraud dataset because it contains transaction type, amount, origin and destination balances, and a fraud label. These fields are relevant for detecting suspicious money movement in digital payments.

### Where is the dataset stored?

The full dataset should be placed at:

```text
ml/dataset/fraud.csv
```

The full CSV is not committed because it is too large. The repository documents where to place it locally.

### What is the prediction target?

The target column is `isFraud`, where fraudulent transactions are labeled separately from legitimate transactions.

### What makes the dataset challenging?

The dataset is highly imbalanced. Fraud cases are rare compared with legitimate transactions, so accuracy alone is not enough to judge model quality.

## Preprocessing

### What preprocessing steps were used?

The notebook checks that the dataset exists, samples the data with a fixed seed, selects transaction and balance features, checks missing values, one-hot encodes transaction type, splits the data with stratification, and scales features for models that need it.

### Why use one-hot encoding?

The `type` column is categorical. One-hot encoding converts transaction categories into numeric indicator columns so classifiers can use them.

### Why use feature scaling?

Scaling is important for Logistic Regression, KNN, Neural Network MLP, KMeans, PCA, and learning curves because those methods are sensitive to feature magnitude.

### Did you remove outliers?

No. Outliers were inspected, but not automatically removed. In fraud detection, unusually large transactions or unusual balance movements may be meaningful fraud signals rather than errors.

## Classifiers

### Which classifiers were compared?

The notebook compares Logistic Regression, KNN, Decision Tree, Random Forest, and Neural Network MLP.

### Why include Logistic Regression?

Logistic Regression is fast, transparent, and useful as a baseline. It helps show whether more complex nonlinear models provide a real improvement.

### Why include KNN?

KNN is a simple non-parametric model that can capture local similarity. However, it is less suitable for large-scale production fraud detection because prediction can be slow.

### Why include Decision Tree?

Decision Trees are interpretable and can model nonlinear rules, but a single tree can overfit and be less stable across different data splits.

### Why did Random Forest perform well?

Random Forest combines many decision trees, reducing variance and improving generalization. It captures nonlinear feature interactions and provides feature importance for explainability.

### Which classifier is most suitable?

Random Forest is the most balanced choice because it combines strong F1-score, practical training and inference cost, nonlinear modeling ability, and explainability through feature importance and SHAP.

## Neural Networks

### Why test a neural network?

The MLP neural network was tested because it can learn nonlinear relationships between transaction amount, account balances, and transaction type.

### What neural network architectures were compared?

The notebook compares architectures such as:

- One hidden layer with 32 units
- One hidden layer with 64 units
- Two hidden layers with 64 and 32 units

### What did the neural network experiment show?

The deeper `64-32` architecture improved recall and F1-score in the recorded architecture comparison by reducing missed fraud cases. However, the model is less interpretable and requires more tuning than Random Forest.

### Why not choose the neural network as the final model?

The neural network had strong ROC-AUC, but Random Forest is easier to explain, simpler to deploy, and more practical for this project.

## Clustering

### Why include clustering?

Clustering was included to explore whether transactions naturally group into patterns related to fraud without using labels.

### Was `isFraud` used during clustering?

No. The target label was removed before KMeans clustering. It was used only afterward to compare clusters with the real fraud labels.

### Which clustering metrics were used?

The notebook uses silhouette score and adjusted Rand index.

### What was the clustering conclusion?

KMeans found transaction groups, but those groups did not strongly align with fraud labels. Supervised classifiers are more appropriate for fraud detection because they directly learn from the fraud label.

## Hyperparameter Tuning

### Why use hyperparameter tuning?

Hyperparameter tuning improves model performance and makes comparison between models fairer.

### What method was used?

The notebook uses `GridSearchCV` with cross-validation.

### Why optimize F1-score?

F1-score balances precision and recall. This is important because fraud detection must catch fraud while limiting unnecessary false alerts.

### Which models were tuned?

Logistic Regression, KNN, Decision Tree, Random Forest, and Neural Network MLP were tuned.

## Evaluation Metrics

### Why is accuracy not enough?

The dataset is imbalanced. A model can predict most transactions as non-fraud and still have high accuracy while missing fraud.

### Which metrics matter most?

The most important metrics are precision, recall, F1-score, ROC-AUC, and confusion matrix counts.

### What is a false positive?

A false positive is a legitimate transaction incorrectly flagged as fraud.

### What is a false negative?

A false negative is a fraudulent transaction missed by the model. This is especially risky because fraud would pass through the system.

### Why use ROC-AUC?

ROC-AUC measures how well the model separates fraud and non-fraud across thresholds. It is useful for comparing probability ranking ability.

## Feature Selection

### What feature selection method was used?

The notebook uses `SelectKBest` with `f_classif`, which ranks features using ANOVA F-values.

### Which features were selected?

The selected features were:

- `amount`
- `newbalanceOrig`
- `type_CASH_IN`
- `type_PAYMENT`
- `type_TRANSFER`

### Did feature selection improve performance?

No. The selected-feature Random Forest performed worse than the all-feature Random Forest, which suggests the removed balance and transaction features still contained useful signal.

## Explainability

### How did you explain model predictions?

The notebook includes Random Forest feature importance and SHAP explainability.

### Why use SHAP?

SHAP shows how features push individual predictions toward fraud or non-fraud. It is suitable for academic reporting because it provides both global and local explanations.

### Which features are expected to matter?

Transaction amount, origin balance changes, destination balance changes, and transaction type indicators are expected to be important because they describe money movement behavior.

## Final Conclusions

### What is the main conclusion?

Supervised learning is more effective than clustering for this task. Random Forest is the strongest practical model because it balances detection performance, interpretability, stability, and deployment simplicity.

### What are the limitations?

The dataset is imbalanced, results depend on the dataset version and threshold choice, and explainability methods do not prove causation.

### What future work would improve the project?

Future work should include threshold tuning, probability calibration, cost-sensitive evaluation, more domain-specific features, model drift monitoring, and validation on newer transaction data.
