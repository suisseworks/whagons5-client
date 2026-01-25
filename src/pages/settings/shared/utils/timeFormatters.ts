/**
 * Convert total minutes to HH:MM format
 */
export const minutesToHHMM = (totalMinutes: number | null | undefined): string => {
  if (totalMinutes == null || !Number.isFinite(totalMinutes) || Number(totalMinutes) <= 0) {
    return '—';
  }
  const hours = Math.floor(Number(totalMinutes) / 60);
  const minutes = Number(totalMinutes) % 60;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
};

/**
 * Convert total seconds to HH:MM format
 */
export const secondsToHHMM = (totalSeconds: number | null | undefined): string => {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || Number(totalSeconds) <= 0) {
    return '—';
  }
  const totalMinutes = Math.floor(Number(totalSeconds) / 60);
  return minutesToHHMM(totalMinutes);
};
