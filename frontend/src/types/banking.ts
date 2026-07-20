export interface Bank {
  id: number;
  name: string;
  country: string;
  swiftCode: string;
}

export interface BankAccount {
  id: number;
  userId: number;
  bankName: string;
  accountType: string;
  maskedAccountNumber: string;
  maskedIban: string;
  currency: string;
  currentBalance: number;
  isActive: boolean;
}

export interface Beneficiary {
  id: number;
  fullName: string;
  bankId: number;
  bankName: string;
  destinationBankAccountId?: number | null;
  maskedAccountReference: string;
  isTrusted: boolean;
}

export interface Merchant {
  id: number;
  name: string;
  category: string;
  country: string;
  riskLevel: string;
}

export interface CreateBeneficiaryInput {
  fullName: string;
  bankId: number;
  accountReference: string;
  isTrusted: boolean;
}
