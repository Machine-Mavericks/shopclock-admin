import { apiFetch } from "./client";

export type CredentialType = "static" | "rotating";
export type UserRole = "student" | "mentor";

export interface User {
  id: number;
  fullName: string;
  role: UserRole;
}

export interface Session {
  id: number;
  userId: number;
  timeIn: number;
  timeOut: number | null;
}

export interface StaticCredential {
  id: string;
  type: "static";
  secret: string;
  qrCode: string;
}

export interface RotatingCredential {
  id: string;
  type: "rotating";
  secret: string;
  qrPrefix: string;
  algorithm: string;
  digits: number;
  period: number;
  enrollmentCode: string;
}

export type Credential = StaticCredential | RotatingCredential;

export interface UserWithCredential {
  user: User;
  credential: Credential;
}

export interface UserDetail {
  user: User;
  punchedIn: boolean | null;
}

export interface PunchToggleResult {
  session: { id: number; userId: number; timeIn: number; timeOut: number | null };
  punchedIn: boolean;
}

export function listUsers(): Promise<User[]> {
  return apiFetch<User[]>("/admin/users");
}

export function createUser(fullName: string, role: UserRole, credentialType: CredentialType, secret?: string): Promise<UserWithCredential> {
  return apiFetch<UserWithCredential>("/admin/users", {
    method: "POST",
    body: JSON.stringify({ fullName, role, credentialType, secret }),
  });
}

export function getUser(id: number): Promise<UserDetail> {
  return apiFetch<UserDetail>(`/admin/users/${id}`);
}

export function setUserRole(id: number, role: UserRole): Promise<User> {
  return apiFetch<User>(`/admin/users/${id}/role`, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}

export function togglePunch(id: number): Promise<PunchToggleResult> {
  return apiFetch<PunchToggleResult>(`/admin/users/${id}/punch`, {
    method: "POST",
  });
}

export function regenerateCredential(id: number, credentialType: CredentialType, secret?: string): Promise<UserWithCredential> {
  return apiFetch<UserWithCredential>(`/admin/users/${id}/credential`, {
    method: "POST",
    body: JSON.stringify({ credentialType, secret }),
  });
}

export function getSessions(id: number): Promise<Session[]> {
  return apiFetch<Session[]>(`/admin/users/${id}/sessions`);
}
