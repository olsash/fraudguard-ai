import { apiGet, apiPost } from "@/services/api";
import type { Bank, BankAccount, Beneficiary, CreateBeneficiaryInput, Merchant } from "@/types/banking";

export const bankingService = {
  getBanks(): Promise<Bank[]> {
    return apiGet<Bank[]>("/banking/banks");
  },

  getAccounts(userId?: number): Promise<BankAccount[]> {
    const query = userId ? `?userId=${userId}` : "";
    return apiGet<BankAccount[]>(`/banking/accounts${query}`);
  },

  getBeneficiaries(): Promise<Beneficiary[]> {
    return apiGet<Beneficiary[]>("/banking/beneficiaries");
  },

  createBeneficiary(payload: CreateBeneficiaryInput): Promise<Beneficiary> {
    return apiPost<Beneficiary>("/banking/beneficiaries", payload);
  },

  getMerchants(): Promise<Merchant[]> {
    return apiGet<Merchant[]>("/banking/merchants");
  },
};
