import { transactions } from "@/data/mockData";

export const transactionService = {
  getTransactions: () => transactions,
  getTransactionById: (id: string) => transactions.find((transaction) => transaction.id === id),
};
