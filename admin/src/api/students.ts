import { apiFetch } from "./client";

export type CredentialType = "static" | "rotating";

export interface Student {
  id: number;
  fullName: string;
}

export interface Session {
  id: number;
  studentId: number;
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

export interface StudentWithCredential {
  student: Student;
  credential: Credential;
}

export interface StudentDetail {
  student: Student;
  punchedIn: boolean | null;
}

export function listStudents(): Promise<Student[]> {
  return apiFetch<Student[]>("/admin/students");
}

export function createStudent(fullName: string, credentialType: CredentialType, secret?: string): Promise<StudentWithCredential> {
  return apiFetch<StudentWithCredential>("/admin/students", {
    method: "POST",
    body: JSON.stringify({ fullName, credentialType, secret }),
  });
}

export function getStudent(id: number): Promise<StudentDetail> {
  return apiFetch<StudentDetail>(`/admin/students/${id}`);
}

export function regenerateCredential(id: number, credentialType: CredentialType, secret?: string): Promise<StudentWithCredential> {
  return apiFetch<StudentWithCredential>(`/admin/students/${id}/credential`, {
    method: "POST",
    body: JSON.stringify({ credentialType, secret }),
  });
}

export function getSessions(id: number): Promise<Session[]> {
  return apiFetch<Session[]>(`/admin/students/${id}/sessions`);
}
