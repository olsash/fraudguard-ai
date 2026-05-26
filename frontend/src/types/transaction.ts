export type TransactionStatus = "safe" | "review" | "fraud";

export interface Transaction {
  id: string;
  user: string;
  merchant: string;
  category: string;
  country: string;
  amount: number;
  currency: string;
  time: string;
  risk: number;
  status: TransactionStatus;
}
