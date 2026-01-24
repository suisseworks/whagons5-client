import { useMemo } from "react";
import { createTimeScale, getTimeScaleConfig } from "../utils/timeScale";
import type { ViewPreset } from "../types/scheduler";

export function useTimeScale(
  preset: ViewPreset,
  width: number,
  baseDate: Date = new Date()
) {
  const config = useMemo(
    () => getTimeScaleConfig(preset, baseDate),
    [preset, baseDate]
  );

  const scale = useMemo(
    () => createTimeScale(config.startDate, config.endDate, width, preset),
    [config.startDate, config.endDate, width, preset]
  );

  return {
    scale,
    config,
    startDate: config.startDate,
    endDate: config.endDate,
  };
}
