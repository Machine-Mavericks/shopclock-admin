import { apiFetch, apiUrl } from "./client";

export type AdminProvider = "fluxer" | "local";

export interface CurrentAdmin {
  provider: AdminProvider;
  username: string;
  avatar: string | null;
}

export function fluxerLoginUrl(): string {
  return apiUrl("/admin/auth/fluxer/login");
}

export function fetchCurrentAdmin(): Promise<CurrentAdmin> {
  return apiFetch<CurrentAdmin>("/admin/auth/me");
}

export function localLogin(username: string, password: string): Promise<{ username: string }> {
  return apiFetch<{ username: string }>("/admin/auth/local/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>("/admin/auth/logout", { method: "POST" });
}
