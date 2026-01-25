import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSquareCheck, faTrash } from "@fortawesome/free-solid-svg-icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
import { Button } from "@/components/ui/button";
import { SettingsDialog, CheckboxField, SelectField, TextAreaField, TextField } from "../../../components";
import type { Approval } from "@/store/types";
import type { ApprovalFormState, ConditionFieldOption, TranslateFn } from "../types";
import { createEmptyFormState } from "../utils/conditions";
import { ConditionBuilder } from "./ConditionBuilder";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: ApprovalFormState;
  setFormData: React.Dispatch<React.SetStateAction<ApprovalFormState>>;
  onSubmit: (e: React.FormEvent) => Promise<void> | void;
  isSubmitting: boolean;
  error?: any;
  editingItem: Approval | null;
  onDeleteClick: () => void;
  deleteDialogTitle: string;
  deleteSectionDescription: string;
  conditionFieldOptions: ConditionFieldOption[];
  ta: TranslateFn;
};

export const EditApprovalDialog = ({
  open,
  onOpenChange,
  formData,
  setFormData,
  onSubmit,
  isSubmitting,
  error,
  editingItem,
  onDeleteClick,
  deleteDialogTitle,
  deleteSectionDescription,
  conditionFieldOptions,
  ta,
}: Props) => {
  return (
    <SettingsDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setFormData(createEmptyFormState());
      }}
      type="edit"
      title={ta("dialog.edit.title", "Edit Approval")}
      description={ta("dialog.edit.description", "Update the approval configuration.")}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      error={error}
      submitDisabled={isSubmitting}
      footerActions={
        editingItem ? (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={onDeleteClick}
            title={deleteSectionDescription}
            aria-label={deleteDialogTitle}
          >
            <FontAwesomeIcon icon={faTrash} />
          </Button>
        ) : undefined
      }
    >
      <div className="rounded-xl bg-gradient-to-r from-sky-50 via-white to-emerald-50 dark:from-sky-900/30 dark:via-slate-900 dark:to-emerald-900/20 border border-sky-100 dark:border-slate-800 px-4 py-3 mb-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-sky-100 dark:border-slate-700 flex items-center justify-center">
          <FontAwesomeIcon icon={faSquareCheck} className="text-sky-600 dark:text-sky-300 w-4 h-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{ta("dialog.edit.heroTitle", "Update approval")}</p>
          <p className="text-xs text-muted-foreground">
            {ta("dialog.edit.heroSubtitle", "Adjust rules, approvers, or deadlines. Leave deadline empty if not needed.")}
          </p>
        </div>
      </div>
      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">{ta("dialog.tabs.general", "General")}</TabsTrigger>
          <TabsTrigger value="rules">{ta("dialog.tabs.rules", "Rules")}</TabsTrigger>
          <TabsTrigger value="trigger">{ta("dialog.tabs.trigger", "Trigger")}</TabsTrigger>
          <TabsTrigger value="timeline">{ta("dialog.tabs.timeline", "Timeline")}</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <div className="grid gap-4 min-h-[320px]">
            <TextField
              id="edit-name"
              label={ta("fields.name", "Name")}
              value={formData.name}
              onChange={(v) => setFormData((p) => ({ ...p, name: v }))}
              required
            />
            <TextAreaField
              id="edit-description"
              label={ta("fields.description", "Description")}
              value={formData.description}
              onChange={(v) => setFormData((p) => ({ ...p, description: v }))}
            />
            <CheckboxField
              id="edit-is_active"
              label={ta("fields.active", "Active")}
              checked={!!formData.is_active}
              onChange={(c) => setFormData((p) => ({ ...p, is_active: c }))}
            />
          </div>
        </TabsContent>
        <TabsContent value="rules">
          <div className="grid gap-4 min-h-[320px]">
            <SelectField
              id="edit-approval_type"
              label={ta("fields.approvalType", "Approval Type")}
              value={formData.approval_type}
              onChange={(v) => setFormData((p) => ({ ...p, approval_type: v as any }))}
              options={[
                { value: "SEQUENTIAL", label: ta("options.approvalType.sequential", "Sequential") },
                { value: "PARALLEL", label: ta("options.approvalType.parallel", "Parallel") },
              ]}
            />
            <CheckboxField
              id="edit-require_all"
              label={ta("fields.requireAll", "Require all approvers")}
              checked={!!formData.require_all}
              onChange={(c) => setFormData((p) => ({ ...p, require_all: c }))}
            />
            {!formData.require_all && (
              <TextField
                id="edit-minimum_approvals"
                label={ta("fields.minimumApprovals", "Minimum approvals")}
                type="number"
                value={String(formData.minimum_approvals)}
                onChange={(v) => setFormData((p) => ({ ...p, minimum_approvals: v }))}
              />
            )}
            <CheckboxField
              id="edit-require_rejection_comment"
              label={ta("fields.requireRejectionComment", "Require rejection comment")}
              checked={!!formData.require_rejection_comment}
              onChange={(c) => setFormData((p) => ({ ...p, require_rejection_comment: c }))}
            />
            <CheckboxField
              id="edit-block_editing_during_approval"
              label={ta("fields.blockEditing", "Block editing during approval")}
              checked={!!formData.block_editing_during_approval}
              onChange={(c) => setFormData((p) => ({ ...p, block_editing_during_approval: c }))}
            />
          </div>
        </TabsContent>
        <TabsContent value="trigger">
          <div className="grid gap-4 min-h-[260px]">
            <SelectField
              id="edit-trigger_type"
              label={ta("fields.triggerType", "Trigger Type")}
              value={formData.trigger_type}
              onChange={(v) => setFormData((p) => ({ ...p, trigger_type: v as any }))}
              options={[
                { value: "ON_CREATE", label: ta("options.triggerType.onCreate", "On Create") },
                { value: "MANUAL", label: ta("options.triggerType.manual", "Manual") },
                { value: "CONDITIONAL", label: ta("options.triggerType.conditional", "Conditional") },
                { value: "ON_COMPLETE", label: ta("options.triggerType.onComplete", "On Complete") },
              ]}
            />
            {formData.trigger_type === "CONDITIONAL" && (
              <ConditionBuilder
                conditions={formData.trigger_conditions}
                onChange={(next) => setFormData((prev) => ({ ...prev, trigger_conditions: next }))}
                fieldOptions={conditionFieldOptions}
                ta={ta}
              />
            )}
          </div>
        </TabsContent>
        <TabsContent value="timeline">
          <div className="grid gap-4 min-h-[260px]">
            <SelectField
              id="edit-deadline_type"
              label={ta("fields.deadlineType", "Deadline Type")}
              value={formData.deadline_type}
              onChange={(v) => setFormData((p) => ({ ...p, deadline_type: v as any }))}
              options={[
                { value: "hours", label: ta("options.deadlineType.hours", "Hours") },
                { value: "date", label: ta("options.deadlineType.date", "Date") },
              ]}
            />
            <TextField
              id="edit-deadline_value"
              label={formData.deadline_type === "hours" ? ta("fields.deadlineHours", "Deadline (hours)") : ta("fields.deadlineDate", "Deadline (date)")}
              type={formData.deadline_type === "hours" ? "number" : "date"}
              value={formData.deadline_value}
              onChange={(v) => setFormData((p) => ({ ...p, deadline_value: v }))}
            />
          </div>
        </TabsContent>
      </Tabs>
    </SettingsDialog>
  );
};

