import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import * as db from "../database";
import * as errors from "./admin.errors";

export async function getCurrentlyPunchedIn(req: Request, res: Response) {
  const entries = await db.listCurrentlyPunchedIn();
  return res.status(200).json(entries);
}

function parseDateParam(raw: unknown): { startMs: number; endMs: number } | null {
  const dateStr = typeof raw === "string" && raw.length > 0 ? raw : null;
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();

  if (Number.isNaN(base.getTime())) {
    return null;
  }

  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);

  return { startMs: start.getTime(), endMs: end.getTime() };
}

function formatTime(ms: number | null): string {
  if (ms === null) {
    return "--";
  }

  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(timeIn: number, timeOut: number | null): string {
  const end = timeOut ?? Date.now();
  const totalMinutes = Math.max(0, Math.round((end - timeIn) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m${timeOut === null ? " (ongoing)" : ""}`;
}

const COLUMNS = [
  { label: "Name", width: 220 },
  { label: "Time In", width: 110 },
  { label: "Time Out", width: 110 },
  { label: "Duration", width: 120 },
];

export async function exportAttendancePdf(req: Request, res: Response) {
  const range = parseDateParam(req.query.date);

  if (!range) {
    return res.status(400).json(errors.MALFORMED_ATTENDANCE_EXPORT_REQUEST);
  }

  const sessions = await db.getSessionsForDateRange(range.startMs, range.endMs);
  const dateLabel = new Date(range.startMs).toLocaleDateString();

  const doc = new PDFDocument({ margin: 40, size: "letter" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-${dateLabel.replace(/\//g, "-")}.pdf"`);

  doc.pipe(res);

  doc.fontSize(16).text(`ShopClock Attendance — ${dateLabel}`, { align: "left" });
  doc.moveDown();

  const startX = doc.page.margins.left;
  let y = doc.y;

  function drawRow(cells: string[], opts: { header?: boolean } = {}) {
    doc.fontSize(10).font(opts.header ? "Helvetica-Bold" : "Helvetica");
    let x = startX;

    for (let i = 0; i < COLUMNS.length; i++) {
      doc.text(cells[i] ?? "", x, y, { width: COLUMNS[i]!.width });
      x += COLUMNS[i]!.width;
    }

    y += 20;

    if (y > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
  }

  drawRow(COLUMNS.map((c) => c.label), { header: true });
  doc.moveTo(startX, y - 4).lineTo(startX + 560, y - 4).stroke();

  if (sessions.length === 0) {
    doc.fontSize(10).font("Helvetica").text("No sessions recorded for this date.", startX, y);
  } else {
    for (const session of sessions) {
      drawRow([
        session.fullName,
        formatTime(session.timeIn),
        formatTime(session.timeOut),
        formatDuration(session.timeIn, session.timeOut),
      ]);
    }
  }

  doc.end();
}
