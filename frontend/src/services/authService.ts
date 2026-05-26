export type AuthRole = "user" | "admin";

export interface AuthUser {
  name: string;
  initials: string;
  email: string;
  role: AuthRole;
}

interface MockAccount extends AuthUser {
  password: string;
  redirectTo: "/app" | "/admin";
}

const AUTH_USER_KEY = "fraudguard.auth.user";
const AUTH_ROLE_KEY = "fraudguard.auth.role";

const mockAccounts: MockAccount[] = [
  {
    name: "Sara Amrani",
    initials: "SA",
    email: "demo@fraudguard.ai",
    password: "password",
    role: "user",
    redirectTo: "/app",
  },
  {
    name: "Admin User",
    initials: "AU",
    email: "admin@fraudguard.ai",
    password: "admin123",
    role: "admin",
    redirectTo: "/admin",
  },
];

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export const authService = {
  getCurrentUser: (): AuthUser | null => {
    if (!canUseStorage()) return null;

    const rawUser = window.localStorage.getItem(AUTH_USER_KEY);
    if (!rawUser) return null;

    try {
      return JSON.parse(rawUser) as AuthUser;
    } catch {
      window.localStorage.removeItem(AUTH_USER_KEY);
      window.localStorage.removeItem(AUTH_ROLE_KEY);
      return null;
    }
  },

  getCurrentRole: (): AuthRole | null => {
    if (!canUseStorage()) return null;
    const role = window.localStorage.getItem(AUTH_ROLE_KEY);
    return role === "admin" || role === "user" ? role : null;
  },

  signIn: (email: string, password: string) => {
    const account = mockAccounts.find(
      (item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password,
    );

    if (!account) {
      throw new Error("Invalid email or password.");
    }

    const { password: _password, redirectTo, ...user } = account;

    if (canUseStorage()) {
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      window.localStorage.setItem(AUTH_ROLE_KEY, user.role);
    }

    return { user, redirectTo };
  },

  signOut: () => {
    if (!canUseStorage()) return;
    window.localStorage.removeItem(AUTH_USER_KEY);
    window.localStorage.removeItem(AUTH_ROLE_KEY);
  },
};
