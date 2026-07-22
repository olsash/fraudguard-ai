export interface Bank {
  id: number;
  name: string;
  country: string;
  swiftCode: string;
}

export interface BankAccount {
  id: number;
  bankId: number;
  bankName: string;
  accountHolderName: string;
  accountType: string;
  maskedAccountNumber: string;
  maskedIban: string;
  currency: string;
  currentBalance: number;
  isActive: boolean;
  linkedAt?: string | null;
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
  merchantCode: string;
  category: string;
  country: string;
  bankName: string;
  riskLevel: string;
}

export interface AdminMerchant extends Merchant {
  merchantCategoryCode?: string | null;
  bankId: number;
  maskedSettlementAccount?: string | null;
  maskedSettlementIban?: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface UpsertMerchantInput {
  name: string;
  merchantCode: string;
  category: string;
  merchantCategoryCode?: string | null;
  country: string;
  bankId: number;
  riskLevel: string;
  isVerified: boolean;
  isActive: boolean;
}

export interface CreateBeneficiaryInput {
  fullName: string;
  bankId: number;
  accountReference: string;
  isTrusted: boolean;
}

export interface ConnectBankAccountInput {
  bankId: number;
  accountHolderName: string;
  accountNumber: string;
  iban: string;
  verificationCode: string;
}

export interface DevelopmentSimulatedBankCredentials {
  bankId: number;
  bankName: string;
  accountHolderName: string;
  accountNumber?: string | null;
  iban?: string | null;
  verificationCode?: string | null;
  accountType: string;
  currency: string;
  currentBalance: number;
  isAlreadyLinked: boolean;
}
