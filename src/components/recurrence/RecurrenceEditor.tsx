import React, { useState, useEffect, useCallback, useMemo } from "react";
import { RRule, Frequency, Weekday } from "rrule";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/providers/LanguageProvider";
import { CalendarIcon, RefreshCw } from "lucide-react";

// Day of week options for weekly recurrence
const WEEKDAYS = [
  { value: RRule.MO, label: "Monday", short: "Mon" },
  { value: RRule.TU, label: "Tuesday", short: "Tue" },
  { value: RRule.WE, label: "Wednesday", short: "Wed" },
  { value: RRule.TH, label: "Thursday", short: "Thu" },
  { value: RRule.FR, label: "Friday", short: "Fri" },
  { value: RRule.SA, label: "Saturday", short: "Sat" },
  { value: RRule.SU, label: "Sunday", short: "Sun" },
];

// Ordinal options for monthly recurrence (e.g., "first Monday", "second Tuesday")
const ORDINALS = [
  { value: 1, label: "First" },
  { value: 2, label: "Second" },
  { value: 3, label: "Third" },
  { value: 4, label: "Fourth" },
  { value: -1, label: "Last" },
];

type FrequencyType = "daily" | "weekly" | "monthly" | "yearly";
type EndType = "never" | "count" | "until";
type MonthlyType = "dayOfMonth" | "dayOfWeek";

export interface RecurrenceEditorProps {
  /** Initial RRule string to parse (optional) */
  initialRRule?: string;
  /** Initial start date (ISO string, e.g., "2026-01-28T09:00:00") */
  dtstart?: string;
  /** Callback when RRule changes */
  onChange: (rrule: string, humanReadable: string) => void;
  /** Disable editing */
  disabled?: boolean;
}

export const RecurrenceEditor: React.FC<RecurrenceEditorProps> = ({
  initialRRule,
  dtstart,
  onChange,
  disabled = false,
}) => {
  const { t } = useLanguage();

  // Recurrence settings state
  const [frequency, setFrequency] = useState<FrequencyType>("weekly");
  const [interval, setInterval] = useState(1);
  const [selectedWeekdays, setSelectedWeekdays] = useState<Weekday[]>([RRule.MO]);
  const [monthlyType, setMonthlyType] = useState<MonthlyType>("dayOfMonth");
  const [monthDay, setMonthDay] = useState(1);
  const [monthOrdinal, setMonthOrdinal] = useState(1);
  const [monthWeekday, setMonthWeekday] = useState<Weekday>(RRule.MO);
  const [endType, setEndType] = useState<EndType>("never");
  const [count, setCount] = useState(10);
  const [untilDate, setUntilDate] = useState("");

  // Preview state
  const [previewDates, setPreviewDates] = useState<string[]>([]);
  const [humanReadable, setHumanReadable] = useState("");

  // Parse initial RRule on mount
  useEffect(() => {
    if (!initialRRule) return;

    try {
      const rule = RRule.fromString(initialRRule);
      const options = rule.origOptions;

      // Set frequency
      switch (options.freq) {
        case Frequency.DAILY:
          setFrequency("daily");
          break;
        case Frequency.WEEKLY:
          setFrequency("weekly");
          break;
        case Frequency.MONTHLY:
          setFrequency("monthly");
          break;
        case Frequency.YEARLY:
          setFrequency("yearly");
          break;
      }

      // Set interval
      if (options.interval) {
        setInterval(options.interval);
      }

      // Set weekdays for weekly
      if (options.byweekday && Array.isArray(options.byweekday)) {
        setSelectedWeekdays(options.byweekday as Weekday[]);
      }

      // Set monthly options
      if (options.bymonthday && Array.isArray(options.bymonthday)) {
        setMonthlyType("dayOfMonth");
        setMonthDay(options.bymonthday[0] as number);
      } else if (options.bysetpos && options.byweekday) {
        setMonthlyType("dayOfWeek");
        const pos = Array.isArray(options.bysetpos) ? options.bysetpos[0] : options.bysetpos;
        setMonthOrdinal(pos as number);
        const day = Array.isArray(options.byweekday) ? options.byweekday[0] : options.byweekday;
        setMonthWeekday(day as Weekday);
      }

      // Set end options
      if (options.count) {
        setEndType("count");
        setCount(options.count);
      } else if (options.until) {
        setEndType("until");
        setUntilDate(options.until.toISOString().split("T")[0]);
      } else {
        setEndType("never");
      }
    } catch (e) {
      console.warn("Failed to parse initial RRule:", e);
    }
  }, [initialRRule]);

  // Build RRule and update preview
  const buildRRule = useCallback(() => {
    const options: Partial<RRule["origOptions"]> = {
      freq: Frequency.WEEKLY, // default
      interval: interval,
    };

    // Set frequency
    switch (frequency) {
      case "daily":
        options.freq = Frequency.DAILY;
        break;
      case "weekly":
        options.freq = Frequency.WEEKLY;
        if (selectedWeekdays.length > 0) {
          options.byweekday = selectedWeekdays;
        }
        break;
      case "monthly":
        options.freq = Frequency.MONTHLY;
        if (monthlyType === "dayOfMonth") {
          options.bymonthday = [monthDay];
        } else {
          options.bysetpos = [monthOrdinal];
          options.byweekday = [monthWeekday];
        }
        break;
      case "yearly":
        options.freq = Frequency.YEARLY;
        break;
    }

    // Set end condition
    if (endType === "count" && count > 0) {
      options.count = count;
    } else if (endType === "until" && untilDate) {
      options.until = new Date(untilDate + "T23:59:59");
    }

    // Add dtstart if provided
    if (dtstart) {
      options.dtstart = new Date(dtstart);
    }

    try {
      const rule = new RRule(options);
      const rruleString = rule.toString().replace("RRULE:", "");
      const readable = rule.toText();

      // Generate preview dates (next 5 occurrences)
      const now = dtstart ? new Date(dtstart) : new Date();
      const nextDates = rule.between(now, new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), true)
        .slice(0, 5)
        .map(d => d.toLocaleDateString(undefined, { 
          weekday: "short", 
          year: "numeric", 
          month: "short", 
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }));

      setPreviewDates(nextDates);
      setHumanReadable(readable);

      // Call onChange with the RRule string (without DTSTART, as that's stored separately)
      const rruleOnly = rruleString.split("\n").find(line => line.startsWith("FREQ=")) || rruleString;
      onChange(rruleOnly, readable);
    } catch (e) {
      console.warn("Failed to build RRule:", e);
    }
  }, [frequency, interval, selectedWeekdays, monthlyType, monthDay, monthOrdinal, monthWeekday, endType, count, untilDate, dtstart, onChange]);

  // Rebuild RRule when any setting changes
  useEffect(() => {
    buildRRule();
  }, [buildRRule]);

  // Toggle weekday selection
  const toggleWeekday = (day: Weekday) => {
    setSelectedWeekdays(prev => {
      if (prev.includes(day)) {
        // Don't allow deselecting the last day
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== day);
      }
      return [...prev, day];
    });
  };

  // Days in month for the day picker
  const daysInMonth = useMemo(() => {
    return Array.from({ length: 31 }, (_, i) => i + 1);
  }, []);

  return (
    <div className="space-y-4">
      {/* Frequency Selection */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label className="text-sm font-medium mb-1.5 block">
            {t("recurrence.frequency") || "Repeat"}
          </Label>
          <Select
            value={frequency}
            onValueChange={(v) => setFrequency(v as FrequencyType)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{t("recurrence.daily") || "Daily"}</SelectItem>
              <SelectItem value="weekly">{t("recurrence.weekly") || "Weekly"}</SelectItem>
              <SelectItem value="monthly">{t("recurrence.monthly") || "Monthly"}</SelectItem>
              <SelectItem value="yearly">{t("recurrence.yearly") || "Yearly"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <Label className="text-sm font-medium mb-1.5 block">
            {t("recurrence.every") || "Every"}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20"
              disabled={disabled}
            />
            <span className="text-sm text-muted-foreground">
              {frequency === "daily" && (interval === 1 ? t("recurrence.day") || "day" : t("recurrence.days") || "days")}
              {frequency === "weekly" && (interval === 1 ? t("recurrence.week") || "week" : t("recurrence.weeks") || "weeks")}
              {frequency === "monthly" && (interval === 1 ? t("recurrence.month") || "month" : t("recurrence.months") || "months")}
              {frequency === "yearly" && (interval === 1 ? t("recurrence.year") || "year" : t("recurrence.years") || "years")}
            </span>
          </div>
        </div>
      </div>

      {/* Weekly: Day Selection */}
      {frequency === "weekly" && (
        <div>
          <Label className="text-sm font-medium mb-2 block">
            {t("recurrence.onDays") || "On days"}
          </Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <Button
                key={day.short}
                type="button"
                variant={selectedWeekdays.includes(day.value) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleWeekday(day.value)}
                disabled={disabled}
                className="min-w-[60px]"
              >
                {day.short}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly: Day of Month or Day of Week */}
      {frequency === "monthly" && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="dayOfMonth"
                checked={monthlyType === "dayOfMonth"}
                onChange={() => setMonthlyType("dayOfMonth")}
                disabled={disabled}
              />
              <Label htmlFor="dayOfMonth" className="text-sm">
                {t("recurrence.onDay") || "On day"}
              </Label>
            </div>
            <Select
              value={monthDay.toString()}
              onValueChange={(v) => setMonthDay(parseInt(v))}
              disabled={disabled || monthlyType !== "dayOfMonth"}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {daysInMonth.map((d) => (
                  <SelectItem key={d} value={d.toString()}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="dayOfWeek"
                checked={monthlyType === "dayOfWeek"}
                onChange={() => setMonthlyType("dayOfWeek")}
                disabled={disabled}
              />
              <Label htmlFor="dayOfWeek" className="text-sm">
                {t("recurrence.onThe") || "On the"}
              </Label>
            </div>
            <Select
              value={monthOrdinal.toString()}
              onValueChange={(v) => setMonthOrdinal(parseInt(v))}
              disabled={disabled || monthlyType !== "dayOfWeek"}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDINALS.map((o) => (
                  <SelectItem key={o.value} value={o.value.toString()}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={monthWeekday.toString()}
              onValueChange={(v) => {
                const day = WEEKDAYS.find(w => w.value.toString() === v);
                if (day) setMonthWeekday(day.value);
              }}
              disabled={disabled || monthlyType !== "dayOfWeek"}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((day) => (
                  <SelectItem key={day.short} value={day.value.toString()}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* End Condition */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {t("recurrence.ends") || "Ends"}
        </Label>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="endNever"
              checked={endType === "never"}
              onChange={() => setEndType("never")}
              disabled={disabled}
            />
            <Label htmlFor="endNever" className="text-sm">
              {t("recurrence.never") || "Never"}
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="endCount"
              checked={endType === "count"}
              onChange={() => setEndType("count")}
              disabled={disabled}
            />
            <Label htmlFor="endCount" className="text-sm">
              {t("recurrence.after") || "After"}
            </Label>
            <Input
              type="number"
              min={1}
              max={9999}
              value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20"
              disabled={disabled || endType !== "count"}
            />
            <span className="text-sm text-muted-foreground">
              {t("recurrence.occurrences") || "occurrences"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="radio"
              id="endUntil"
              checked={endType === "until"}
              onChange={() => setEndType("until")}
              disabled={disabled}
            />
            <Label htmlFor="endUntil" className="text-sm">
              {t("recurrence.onDate") || "On date"}
            </Label>
            <Input
              type="date"
              value={untilDate}
              onChange={(e) => setUntilDate(e.target.value)}
              className="w-40"
              disabled={disabled || endType !== "until"}
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="border rounded-lg p-3 bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {t("recurrence.preview") || "Preview"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-2 capitalize">
          {humanReadable || t("recurrence.noRule") || "No recurrence rule"}
        </p>
        {previewDates.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("recurrence.nextOccurrences") || "Next occurrences:"}
            </p>
            <ul className="text-sm space-y-0.5">
              {previewDates.map((date, i) => (
                <li key={i} className="flex items-center gap-2">
                  <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                  {date}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecurrenceEditor;
