import { apiGet, apiPost } from "@/services/api";
import type { Bank, BankAccount, Beneficiary, ConnectBankAccountInput, CreateBeneficiaryInput, DevelopmentSimulatedBankCredentials, Merchant } from "@/types/banking";

export const bankingService = {
  getBanks(): Promise<Bank[]> {
    return apiGet<Bank[]>("/banks");
  },

  getAccounts(userId?: number): Promise<BankAccount[]> {
    const query = userId ? `?userId=${userId}` : "";
    return userId ? apiGet<BankAccount[]>(`/banking/accounts${query}`) : apiGet<BankAccount[]>("/bank-accounts/my");
  },

  connectAccount(payload: ConnectBankAccountInput): Promise<BankAccount> {
    return apiPost<BankAccount>("/bank-accounts/connect", payload);
  },

  getDevelopmentSimulatedCredentials(bankId: number): Promise<DevelopmentSimulatedBankCredentials> {
    return apiGet<DevelopmentSimulatedBankCredentials>(`/development/simulated-bank-credentials/${bankId}`);
  },

  getBeneficiaries(): Promise<Beneficiary[]> {
    return apiGet<Beneficiary[]>("/banking/beneficiaries");
  },

  createBeneficiary(payload: CreateBeneficiaryInput): Promise<Beneficiary> {
    return apiPost<Beneficiary>("/banking/beneficiaries", payload);
  },

  getMerchants(): Promise<Merchant[]> {
    return apiGet<Merchant[]>("/merchants/active");
  },
};
