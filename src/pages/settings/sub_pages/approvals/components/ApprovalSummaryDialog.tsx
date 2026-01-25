import { useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Approval, ApprovalApprover } from "@/store/types";
import type { TranslateFn } from "../types";
import { CONDITION_OPERATOR_LABELS, formatTemplate } from "../utils/conditions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summaryApproval: Approval | null;
  setSummaryApproval: (approval: Approval | null) => void;
  approvalApprovers: ApprovalApprover[];
  users: any[];
  roles: any[];
  tasks: any[];
  ta: TranslateFn;
  renderDeadline: (type: string, value?: string | null) => string;
  getTriggerTypeLabel: (type?: string | null) => string;
};

export const ApprovalSummaryDialog = ({
  open,
  onOpenChange,
  summaryApproval,
  setSummaryApproval,
  approvalApprovers,
  users,
  roles,
  tasks,
  ta,
  renderDeadline,
  getTriggerTypeLabel,
}: Props) => {
  const requirementLabel = useCallback(
    (a?: Approval | null) => {
      if (!a) return "";
      if ((a as any).require_all) return ta("grid.requirement.all", "All approvers");
      if ((a as any).minimum_approvals)
        return formatTemplate(ta("grid.requirement.minimum", "Minimum {count}"), { count: (a as any).minimum_approvals });
      return ta("grid.requirement.minimumFallback", "Minimum N/A");
    },
    [ta]
  );

  const summaryApprovers = useMemo(() => {
    const aid = Number((summaryApproval as any)?.id);
    if (!summaryApproval || !Number.isFinite(aid)) return [];
    return (approvalApprovers || []).filter((a: any) => Number(a?.approval_id ?? a?.approvalId) === aid);
  }, [summaryApproval, approvalApprovers]);

  const formattedConditions = useMemo(() => {
    if (!summaryApproval || (summaryApproval as any).trigger_type !== "CONDITIONAL") return [];
    const ops = CONDITION_OPERATOR_LABELS(ta);
    return (((summaryApproval as any).trigger_conditions || []) as any[]).map((c, idx) => {
      const label = c.label || c.field || `${ta("summary.condition", "Condition")} ${idx + 1}`;
      const opLabel = (ops as any)[c.operator] || c.operator;
      let valueText = "";
      if (c.value_label) valueText = String(c.value_label);
      else if (Array.isArray(c.value)) valueText = c.value.join(", ");
      else if (c.value !== undefined && c.value !== null) valueText = String(c.value);
      return `${label} ${opLabel}${valueText ? ` ${valueText}` : ""}`;
    });
  }, [summaryApproval, ta]);

  const requiredCount = useMemo(() => summaryApprovers.filter((a: any) => !!a?.required).length, [summaryApprovers]);

  const approverName = useCallback(
    (a: any) => {
      if (!a) return "";
      const id = Number(a.approver_id);
      if (a.approver_type === "user") {
        return users.find((u) => u.id === id)?.name || `User #${id}`;
      }
      return roles.find((r) => r.id === id)?.name || `Role #${id}`;
    },
    [users, roles]
  );

  const usageCount = useMemo(() => {
    const aid = Number((summaryApproval as any)?.id);
    if (!Number.isFinite(aid) || !Array.isArray(tasks)) return 0;
    return tasks.filter((t: any) => Number(t?.approval_id) === aid).length;
  }, [summaryApproval, tasks]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSummaryApproval(null);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FontAwesomeIcon icon={faInfoCircle} className="text-sky-600 w-4 h-4" />
            {(summaryApproval as any)?.name || ta("summary.title", "Approval Summary")}
          </DialogTitle>
          <DialogDescription>
            {(summaryApproval as any)?.description || ta("summary.description", "Overview and key details")}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">{ta("summary.tabs.overview", "Overview")}</TabsTrigger>
            <TabsTrigger value="approvers">{ta("summary.tabs.approvers", "Approvers")}</TabsTrigger>
            <TabsTrigger value="stats">{ta("summary.tabs.stats", "Stats")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3 pt-3">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">{ta("summary.approvalType", "Approval type")}</div>
                <div className="font-medium">
                  {(summaryApproval as any)?.approval_type === "PARALLEL"
                    ? ta("grid.values.parallel", "Parallel")
                    : ta("grid.values.sequential", "Sequential")}
                </div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">{ta("summary.trigger", "Trigger")}</div>
                <div className="font-medium">{getTriggerTypeLabel((summaryApproval as any)?.trigger_type)}</div>
              </div>
              {formattedConditions.length > 0 && (
                <div className="p-3 border rounded-lg md:col-span-2 space-y-2">
                  <div className="text-xs text-muted-foreground">{ta("summary.conditions", "Conditions")}</div>
                  <div className="space-y-1">
                    {formattedConditions.map((text, idx) => (
                      <div key={idx} className="text-sm text-foreground">
                        {text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="p-3 border rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">{ta("summary.requirement", "Requirement")}</div>
                <div className="font-medium">{requirementLabel(summaryApproval)}</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">{ta("summary.deadline", "Deadline")}</div>
                <div className="font-medium">
                  {(summaryApproval as any)?.deadline_value
                    ? renderDeadline((summaryApproval as any)?.deadline_type as any, (summaryApproval as any)?.deadline_value as any)
                    : ta("summary.noDeadline", "None")}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="approvers" className="space-y-3 pt-3">
            {summaryApprovers.length === 0 ? (
              <div className="p-3 border rounded-lg text-sm text-muted-foreground">{ta("summary.noApprovers", "No approvers assigned yet.")}</div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {summaryApprovers.map((a: any) => (
                  <div key={a.id ?? `${a.approver_type}-${a.approver_id}`} className="p-3 border rounded-lg flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{approverName(a)}</div>
                      <div className="text-xs text-muted-foreground capitalize">{a.approver_type}</div>
                    </div>
                    <Badge variant={a.required ? "default" : "outline"}>{a.required ? ta("summary.required", "Required") : ta("summary.optional", "Optional")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stats" className="space-y-3 pt-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3 border rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">{ta("summary.approvers", "Approvers")}</div>
                <div className="font-medium">{summaryApprovers.length}</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">{ta("summary.requiredCount", "Required approvers")}</div>
                <div className="font-medium">{requiredCount}</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">{ta("summary.usage", "Times used")}</div>
                <div className="font-medium">{usageCount}</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">{ta("summary.conditions", "Conditions")}</div>
                <div className="font-medium">
                  {(summaryApproval as any)?.trigger_type === "CONDITIONAL"
                    ? (((summaryApproval as any)?.trigger_conditions || []).length || 0)
                    : ta("summary.notApplicable", "N/A")}
                </div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">{ta("summary.deadline", "Deadline")}</div>
                <div className="font-medium">
                  {(summaryApproval as any)?.deadline_value
                    ? renderDeadline((summaryApproval as any)?.deadline_type as any, (summaryApproval as any)?.deadline_value as any)
                    : ta("summary.noDeadline", "None")}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

