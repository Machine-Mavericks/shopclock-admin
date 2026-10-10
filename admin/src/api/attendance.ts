import { apiFetch, apiUrl } from "./client";

export interface CurrentlyPunchedIn {
  studentId: number;
  fullName: string;
  timeIn: number;
}

export function listCurrentlyPunchedIn(): Promise<CurrentlyPunchedIn[]> {
  return apiFetch<CurrentlyPunchedIn[]>("/admin/attendance/current");
}

export function attendanceExportUrl(date: string): string {
  return apiUrl(`/admin/attendance/export?date=${encodeURIComponent(date)}`);
}
