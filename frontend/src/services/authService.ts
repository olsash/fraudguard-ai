import { apiConfig } from "@/config/apiConfig";

export type AuthRole = "user" | "admin";

export interface AuthUser {
  id: number;
  name: string;
  initials: string;
  email: string;
  role: AuthRole;
}

export interface BackendAuthUser {
  id: number;
  fullName: string;
  email: string;
  role: "User" | "Admin" | string;
}

interface AuthResponse {
  token: string;
  user: BackendAuthUser;
}

const AUTH_TOKEN_KEY = "fraudguard_token";
const AUTH_USER_KEY = "fraudguard_user";
const AUTH_ROLE_KEY = "fraudguard.auth.role";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "FG";
}

export function mapBackendUser(user: BackendAuthUser): AuthUser {
  return {
    id: user.id,
    name: user.fullName,
    initials: getInitials(user.fullName),
    email: user.email,
    role: user.role.toLowerCase() === "admin" ? "admin" : "user",
  };
}

async function parseAuthResponse(response: Response): Promise<AuthResponse> {
  if (response.ok) {
    return response.json() as Promise<AuthResponse>;
  }

  let message = "Unable to sign in.";

  try {
    const body = (await response.json()) as { message?: string };
    message = body.message ?? message;
  } catch {
    message = `Authentication failed: ${response.status}`;
  }

  throw new Error(message);
}

function storeSession(token: string, user: AuthUser) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  window.localStorage.setItem(AUTH_ROLE_KEY, user.role);
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
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      return null;
    }
  },

  getToken: (): string | null => {
    if (!canUseStorage()) return null;
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  },

  getCurrentRole: (): AuthRole | null => {
    if (!canUseStorage()) return null;
    const role = window.localStorage.getItem(AUTH_ROLE_KEY);
    return role === "admin" || role === "user" ? role : null;
  },

  signIn: async (email: string, password: string) => {
    const response = await fetch(`${apiConfig.baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await parseAuthResponse(response);
    const user = mapBackendUser(data.user);
    const redirectTo = user.role === "admin" ? "/admin" : "/app";

    storeSession(data.token, user);

    return { user, redirectTo };
  },

  register: async (fullName: string, email: string, password: string) => {
    const response = await fetch(`${apiConfig.baseUrl}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fullName, email, password }),
    });

    const data = await parseAuthResponse(response);
    const user = mapBackendUser(data.user);

    storeSession(data.token, user);

    return { user, redirectTo: "/app" as const };
  },

  refreshCurrentUser: async () => {
    const token = authService.getToken();

    if (!token) {
      return null;
    }

    const response = await fetch(`${apiConfig.baseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      authService.signOut();
      return null;
    }

    const backendUser = (await response.json()) as BackendAuthUser;
    const user = mapBackendUser(backendUser);

    if (canUseStorage()) {
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      window.localStorage.setItem(AUTH_ROLE_KEY, user.role);
    }

    return user;
  },

  saveCurrentUser: (backendUser: BackendAuthUser) => {
    const user = mapBackendUser(backendUser);

    if (canUseStorage()) {
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      window.localStorage.setItem(AUTH_ROLE_KEY, user.role);
    }

    return user;
  },

  signOut: () => {
    if (!canUseStorage()) return;
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_USER_KEY);
    window.localStorage.removeItem(AUTH_ROLE_KEY);
  },
};
