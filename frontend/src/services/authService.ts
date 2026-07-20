import { apiConfig } from "@/config/apiConfig";

export type AuthRole = "user" | "fraudAnalyst" | "admin";

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
  role: "User" | "FraudAnalyst" | "Admin" | string;
}

interface AuthResponse {
  token: string;
  user: BackendAuthUser;
}

export type AuthErrorField = "email" | "password" | "phone";

export class AuthApiError extends Error {
  code?: string;
  field?: AuthErrorField;
  status?: number;

  constructor(message: string, options: { code?: string; field?: string; status?: number } = {}) {
    super(message);
    this.name = "AuthApiError";
    this.code = options.code;
    this.field =
      options.field === "email" || options.field === "password" || options.field === "phone"
        ? options.field
        : undefined;
    this.status = options.status;
  }
}

const AUTH_TOKEN_KEY = "fraudguard_token";
const AUTH_USER_KEY = "fraudguard_user";
const AUTH_ROLE_KEY = "fraudguard.auth.role";
const AUTH_STORAGE_KEYS = [AUTH_TOKEN_KEY, AUTH_USER_KEY, AUTH_ROLE_KEY];
export const AUTH_USER_CHANGED_EVENT = "fraudguard:user-changed";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function clearAuthStorage() {
  if (typeof window === "undefined") return;

  for (const key of AUTH_STORAGE_KEYS) {
    window.localStorage?.removeItem(key);
    window.sessionStorage?.removeItem(key);
  }
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "FG";
}

export function normalizeAuthRole(role: string | null | undefined): AuthRole {
  const normalized = (role ?? "").replace(/[\s_-]/g, "").toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "fraudanalyst" || normalized === "analyst") return "fraudAnalyst";
  return "user";
}

function getRedirectForRole(role: AuthRole) {
  if (role === "admin") return "/admin" as const;
  if (role === "fraudAnalyst") return "/analyst" as const;
  return "/app" as const;
}

export function mapBackendUser(user: BackendAuthUser): AuthUser {
  return {
    id: user.id,
    name: user.fullName,
    initials: getInitials(user.fullName),
    email: user.email,
    role: normalizeAuthRole(user.role),
  };
}

async function parseAuthResponse(
  response: Response,
  messages: {
    fallback: string;
    serviceUnavailable: string;
  },
): Promise<AuthResponse> {
  if (response.ok) {
    return response.json() as Promise<AuthResponse>;
  }

  let message = messages.fallback;
  let code: string | undefined;
  let field: string | undefined;

  try {
    const body = (await response.json()) as { code?: string; field?: string; message?: string };
    message = response.status >= 500 ? messages.serviceUnavailable : body.message ?? message;
    code = body.code;
    field = body.field;
  } catch {
    message = response.status >= 500
      ? messages.serviceUnavailable
      : `Authentication failed: ${response.status}`;
  }

  throw new AuthApiError(message, { code, field, status: response.status });
}

function storeSession(token: string, user: AuthUser) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  window.localStorage.setItem(AUTH_ROLE_KEY, user.role);
  window.dispatchEvent(new CustomEvent(AUTH_USER_CHANGED_EVENT, { detail: user }));
}

export const authService = {
  getCurrentUser: (): AuthUser | null => {
    if (!canUseStorage()) return null;

    const rawUser = window.localStorage.getItem(AUTH_USER_KEY);
    if (!rawUser) return null;

    try {
      const user = JSON.parse(rawUser) as AuthUser;
      return { ...user, role: normalizeAuthRole(user.role) };
    } catch {
      clearAuthStorage();
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
    if (!role) return null;

    const normalized = role.replace(/[\s_-]/g, "").toLowerCase();
    return normalized === "admin" || normalized === "fraudanalyst" || normalized === "analyst" || normalized === "user"
      ? normalizeAuthRole(role)
      : null;
  },

  signIn: async (email: string, password: string) => {
    let response: Response;

    try {
      response = await fetch(`${apiConfig.baseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new AuthApiError("Login service is currently unavailable. Please try again.", {
        code: "LOGIN_SERVICE_UNAVAILABLE",
        status: 0,
      });
    }

    const data = await parseAuthResponse(response, {
      fallback: "Unable to sign in.",
      serviceUnavailable: "Login service is currently unavailable. Please try again.",
    });
    const user = mapBackendUser(data.user);
    const redirectTo = getRedirectForRole(user.role);

    storeSession(data.token, user);

    return { user, redirectTo };
  },

  register: async (fullName: string, email: string, password: string) => {
    let response: Response;

    try {
      response = await fetch(`${apiConfig.baseUrl}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullName, email, password }),
      });
    } catch {
      throw new AuthApiError("Registration service is currently unavailable. Please try again.", {
        code: "REGISTRATION_SERVICE_UNAVAILABLE",
        status: 0,
      });
    }

    const data = await parseAuthResponse(response, {
      fallback: "Unable to create account.",
      serviceUnavailable: "Registration service is currently unavailable. Please try again.",
    });
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
      window.dispatchEvent(new CustomEvent(AUTH_USER_CHANGED_EVENT, { detail: user }));
    }

    return user;
  },

  saveCurrentUser: (backendUser: BackendAuthUser) => {
    const user = mapBackendUser(backendUser);

    if (canUseStorage()) {
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      window.localStorage.setItem(AUTH_ROLE_KEY, user.role);
      window.dispatchEvent(new CustomEvent(AUTH_USER_CHANGED_EVENT, { detail: user }));
    }

    return user;
  },

  signOut: () => {
    clearAuthStorage();
    window.dispatchEvent(new CustomEvent(AUTH_USER_CHANGED_EVENT, { detail: null }));
  },
};
