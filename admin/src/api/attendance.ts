import { apiFetch, apiUrl } from "./client";

export interface CurrentlyPunchedIn {
  userId: number;
  fullName: string;
  timeIn: number;
}

export function listCurrentlyPunchedIn(): Promise<CurrentlyPunchedIn[]> {
  return apiFetch<CurrentlyPunchedIn[]>("/admin/attendance/current");
}

export function attendanceExportUrl(date: string, timeZone: string): string {
  const params = new URLSearchParams({ date, tz: timeZone });
  return apiUrl(`/admin/attendance/export?${params.toString()}`);
}
