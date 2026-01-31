import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RecurrenceEditor } from '@/components/recurrence/RecurrenceEditor';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';

export interface RecurrenceSettings {
  enabled: boolean;
  rrule: string;
  humanReadable: string;
  editScope?: 'this' | 'future'; // For editing existing recurring tasks
}

export function DateTimingTab(props: any) {
  const { 
    mode, 
    startDate, 
    setStartDate, 
    startTime, 
    setStartTime, 
    dueDate, 
    setDueDate, 
    dueTime, 
    setDueTime,
    // Recurrence props
    recurrenceSettings,
    setRecurrenceSettings,
    isExistingRecurringTask,
    // Flag to hide date/recurrence when shown in BasicTab (from scheduler)
    isFromScheduler,
  } = props;

  const { t } = useLanguage();

  // Handle recurrence toggle
  const handleRecurrenceToggle = (enabled: boolean) => {
    setRecurrenceSettings?.((prev: RecurrenceSettings) => ({
      ...prev,
      enabled,
      editScope: enabled ? 'future' : prev.editScope,
    }));
  };

  // Handle RRule change from editor
  const handleRRuleChange = (rrule: string, humanReadable: string) => {
    setRecurrenceSettings?.((prev: RecurrenceSettings) => ({
      ...prev,
      rrule,
      humanReadable,
    }));
  };

  // Handle edit scope change for existing recurring tasks
  const handleEditScopeChange = (scope: 'this' | 'future') => {
    setRecurrenceSettings?.((prev: RecurrenceSettings) => ({
      ...prev,
      editScope: scope,
    }));
  };

  // Build dtstart from date/time fields
  const dtstart = startDate && startTime 
    ? `${startDate}T${startTime}:00` 
    : startDate 
      ? `${startDate}T09:00:00`
      : undefined;

  return (
    <div className="space-y-4">
      {/* Start Date & Time - Hidden when from scheduler (shown in BasicTab instead) */}
      {!isFromScheduler && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="start" className="text-sm font-medium font-[500] text-foreground">
              {t("taskDialog.startDate", "Start Date")}
            </Label>
            <div className="flex gap-2">
              <Input 
                id="start" 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="flex-1 h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background" 
              />
              <Input 
                id="start-time" 
                type="time" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)} 
                className="w-32 h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background" 
              />
            </div>
          </div>

          {/* Due Date & Time */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="due" className="text-sm font-medium font-[500] text-foreground">
              {t("taskDialog.dueDate", "Due Date")}
            </Label>
            <div className="flex gap-2">
              <Input 
                id="due" 
                type="date" 
                value={dueDate} 
                onChange={(e) => setDueDate(e.target.value)} 
                className="flex-1 h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background" 
              />
              <Input 
                id="due-time" 
                type="time" 
                value={dueTime} 
                onChange={(e) => setDueTime(e.target.value)} 
                className="w-32 h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background" 
              />
            </div>
          </div>
        </>
      )}

      {/* Recurrence Section - Show for create mode and edit mode, hidden when from scheduler */}
      {!isFromScheduler && recurrenceSettings && setRecurrenceSettings && (
        <div className="flex flex-col gap-3 pt-2 border-t">
          {/* Recurrence Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium font-[500] text-foreground">
                {t("recurrence.repeatTask") || "Repeat Task"}
              </Label>
            </div>
            <Switch
              checked={recurrenceSettings.enabled}
              onCheckedChange={handleRecurrenceToggle}
              disabled={mode === 'edit' && isExistingRecurringTask}
            />
          </div>

          {/* Edit scope for existing recurring tasks */}
          {mode === 'edit' && isExistingRecurringTask && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                  {t("recurrence.editingRecurringTask") || "This is a recurring task"}
                </p>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editScope"
                      checked={recurrenceSettings.editScope === 'this'}
                      onChange={() => handleEditScopeChange('this')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-amber-700 dark:text-amber-300">
                      {t("recurrence.editThisOnly") || "Edit only this task"}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editScope"
                      checked={recurrenceSettings.editScope === 'future'}
                      onChange={() => handleEditScopeChange('future')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-amber-700 dark:text-amber-300">
                      {t("recurrence.editAllFuture") || "Edit all future tasks"}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Recurrence Editor - shown when enabled and creating new recurrence or editing non-recurring task */}
          {recurrenceSettings.enabled && (mode === 'create' || (mode === 'edit' && !isExistingRecurringTask)) && (
            <div className="pl-6">
              <RecurrenceEditor
                initialRRule={recurrenceSettings.rrule}
                dtstart={dtstart}
                onChange={handleRRuleChange}
              />
            </div>
          )}

          {/* Show current recurrence info for existing recurring tasks */}
          {mode === 'edit' && isExistingRecurringTask && recurrenceSettings.humanReadable && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pl-6">
              <span>{t("recurrence.currentPattern") || "Current pattern:"}</span>
              <span className="font-medium capitalize">{recurrenceSettings.humanReadable}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
