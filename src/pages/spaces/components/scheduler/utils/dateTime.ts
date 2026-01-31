const DEFAULT_TIME = "00:00:00";

export function parseLocalDateTime(dateStr: string): Date {
  if (!dateStr) {
    return new Date();
  }

  let cleaned = dateStr.trim();
  cleaned = cleaned.replace(/\.\d+Z?$/i, "");
  cleaned = cleaned.replace(/Z$/i, "");
  cleaned = cleaned.replace(/[+-]\d{2}:\d{2}$/, "");
  cleaned = cleaned.replace(" ", "T");

  const [datePart, timePart = DEFAULT_TIME] = cleaned.split("T");
  if (!datePart) {
    return new Date();
  }

  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes, seconds = 0] = timePart.split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

export function parseFloatingDateTime(dateStr: string): Date {
  if (!dateStr) {
    return new Date();
  }

  let cleaned = dateStr.trim();
  cleaned = cleaned.replace(/\.\d+Z?$/i, "");
  cleaned = cleaned.replace(/Z$/i, "");
  cleaned = cleaned.replace(/[+-]\d{2}:\d{2}$/, "");
  cleaned = cleaned.replace(" ", "T");

  const [datePart, timePart = DEFAULT_TIME] = cleaned.split("T");
  if (!datePart) {
    return new Date();
  }

  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes, seconds = 0] = timePart.split(":").map(Number);

  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
}

export function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export function formatLocalDateTimeWithOffset(date: Date): string {
  const base = formatLocalDateTime(date);
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const offsetMins = String(absMinutes % 60).padStart(2, "0");
  return `${base}${sign}${offsetHours}:${offsetMins}`;
}

export function formatLocalDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatLocalTimeInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function combineLocalDateAndTime(dateStr: string, timeStr: string): Date {
  if (!dateStr) {
    return new Date();
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours = 0, minutes = 0, seconds = 0] = (timeStr || DEFAULT_TIME)
    .split(":")
    .map(Number);

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

export function snapDateToInterval(date: Date, intervalMs: number): Date {
  const time = date.getTime();
  const snapped = Math.round(time / intervalMs) * intervalMs;
  return new Date(snapped);
}
