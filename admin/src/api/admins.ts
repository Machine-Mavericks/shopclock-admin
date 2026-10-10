import { apiFetch } from "./client";

export interface LocalAdmin {
  id: number;
  username: string;
  disabled: boolean;
  createdAt: string;
}

export interface FluxerAdminId {
  id: number;
  fluxerId: string;
  label: string | null;
  addedBy: string | null;
  createdAt: string;
}

export interface AdminsOverview {
  local: LocalAdmin[];
  fluxer: FluxerAdminId[];
}

export function listAdmins(): Promise<AdminsOverview> {
  return apiFetch<AdminsOverview>("/admin/admins");
}

export function createLocalAdmin(username: string, password: string): Promise<LocalAdmin> {
  return apiFetch<LocalAdmin>("/admin/admins/local", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function setLocalAdminDisabled(id: number, disabled: boolean): Promise<LocalAdmin> {
  return apiFetch<LocalAdmin>(`/admin/admins/local/${id}/disabled`, {
    method: "POST",
    body: JSON.stringify({ disabled }),
  });
}

export function addFluxerAdminId(fluxerId: string, label: string | null): Promise<FluxerAdminId> {
  return apiFetch<FluxerAdminId>("/admin/admins/fluxer", {
    method: "POST",
    body: JSON.stringify({ fluxerId, label }),
  });
}

export function removeFluxerAdminId(id: number): Promise<void> {
  return apiFetch<void>(`/admin/admins/fluxer/${id}`, { method: "DELETE" });
}
