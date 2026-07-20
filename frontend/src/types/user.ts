export type UserStatus = "active" | "suspended";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "FraudAnalyst" | "User";
  status: UserStatus;
  risk: number;
  created: string;
}
