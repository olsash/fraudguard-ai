# Development Fraud Review Flow

FraudGuard-AI uses simulated academic banking data in Development. These steps use the real transaction, prediction, alert, and fraud-case services; they do not insert partial database rows and they do not connect to live bank APIs.

1. Start the ASP.NET Core backend and the frontend.
2. Log in as a normal User.
3. Connect a simulated bank account from the My Accounts page.
4. Create a low-risk payment or transfer. The ML prediction is saved, the transaction becomes `Completed`, and balances update atomically.
5. Create a medium-risk transaction. The transaction becomes `PendingReview`, balances do not change, and one fraud alert plus one fraud case is created.
6. Create a high-risk transaction. The transaction becomes `BlockedPendingReview`, balances do not change, and one high-priority fraud alert plus one fraud case is created.
7. Log out.
8. Log in as `analyst@fraudguard.com` in Development.
9. Open `/analyst/review-queue`.
10. Claim a case.
11. Start review.
12. Add an analyst note.
13. Choose one final decision:
    - Approve: revalidates balances, completes the transaction, and applies balances atomically.
    - False Positive: preserves the original fraud prediction, stores the analyst decision separately, revalidates balances, and completes the transaction.
    - Confirm Fraud: preserves the original prediction, rejects the transaction, and does not move funds.
14. Log back in as the User.
15. Verify the transaction status and account balance. Balances change only for completed transactions.

Configured default risk policy:

- `0-39`: low risk, complete automatically.
- `40-69`: requires analyst review.
- `70-100`: temporarily blocked pending analyst review.
