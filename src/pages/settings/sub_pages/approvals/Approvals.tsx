import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleQuestion, faPlus, faSquareCheck } from "@fortawesome/free-solid-svg-icons";
import type { ColDef } from "ag-grid-community";

import { Button } from "@/components/ui/button";
import { UrlTabs } from "@/components/ui/url-tabs";
import { useLanguage } from "@/providers/LanguageProvider";
import type { RootState } from "@/store/store";
import type { Approval, ApprovalApprover, CustomField, Status } from "@/store/types";

import { SettingsLayout, SettingsDialog, SettingsGrid, useSettingsState, ApprovalApproversManager } from "../../components";

import { ApprovalActionsDialog } from "./components/actions/ApprovalActionsDialog";
import { ApprovalSummaryDialog } from "./components/ApprovalSummaryDialog";
import { ApprovalsHelpTab } from "./components/ApprovalsHelpTab";
import { CreateApprovalDialog } from "./components/CreateApprovalDialog";
import { EditApprovalDialog } from "./components/EditApprovalDialog";
import { useApprovalsColumnDefs } from "./utils/columnDefs";
import { buildConditionFieldOptions, createEmptyFormState, formatTemplate, sanitizeConditionsForSubmit } from "./utils/conditions";
import type { ApprovalFormState } from "./types";

function Approvals() {
  const { t } = useLanguage();
  const ta = useCallback((key: string, fallback: string) => t(`settings.approvals.${key}`, fallback), [t]);

  const {
    filteredItems,
    loading,
    error,
    deleteItem,
    isDeleteDialogOpen,
    handleDelete,
    handleCloseDeleteDialog,
    deletingItem,
    isSubmitting,
    formError,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    setEditingItem,
    editingItem,
    createItem,
    updateItem,
  } = useSettingsState<Approval>({
    entityName: "approvals",
    searchFields: ["name", "description"] as any,
  });

  const renderDeadline = useCallback((type: string, value?: string | null) => {
    if (!value) return "-";
    if (type === "hours") return `${value} h`;
    if (type === "date") return value;
    return value;
  }, []);

  const nameRequiredError = ta("general.errors.nameRequired", "Name is required");
  const emptyValueLabel = ta("grid.values.none", "None");

  const triggerTypeLabelMap = useMemo(
    () => ({
      ON_CREATE: ta("options.triggerType.onCreate", "On Create"),
      MANUAL: ta("options.triggerType.manual", "Manual"),
      CONDITIONAL: ta("options.triggerType.conditional", "Conditional"),
      ON_COMPLETE: ta("options.triggerType.onComplete", "On Complete"),
    }),
    [ta]
  );

  const getTriggerTypeLabel = useCallback(
    (type?: string | null) => {
      const normalized = String(type || "").toUpperCase();
      return (triggerTypeLabelMap as any)[normalized] ?? (type ? type : emptyValueLabel);
    },
    [triggerTypeLabelMap, emptyValueLabel]
  );

  const getApprovalTypeLabel = useCallback(
    (type?: string | null) => {
      const normalized = String(type || "").toUpperCase();
      return normalized === "PARALLEL" ? ta("grid.values.parallel", "Parallel") : ta("grid.values.sequential", "Sequential");
    },
    [ta]
  );

  const deleteDialogTitle = ta("dialog.delete.title", "Delete Approval");
  const deleteDescriptionTemplate = ta(
    "dialog.delete.description",
    'Are you sure you want to delete the approval "{name}"? This action cannot be undone.'
  );
  const deleteEntityName = ta("dialog.delete.entityName", "approval");
  const previewTypeLabel = ta("preview.typeLabel", "Type");
  const previewTriggerLabel = ta("preview.triggerLabel", "Trigger");
  const previewConditionsLabel = ta("preview.conditionsLabel", "Conditions");
  const deleteDescription = deletingItem
    ? formatTemplate(deleteDescriptionTemplate, { name: (deletingItem as any).name ?? "" })
    : undefined;
  const deleteSectionDescription = editingItem
    ? formatTemplate(deleteDescriptionTemplate, { name: (editingItem as any).name ?? "" })
    : ta("dialog.delete.description", "Are you sure you want to delete this approval? This action cannot be undone.");

  const [isApproversDialogOpen, setIsApproversDialogOpen] = useState(false);
  const [approversApproval, setApproversApproval] = useState<Approval | null>(null);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [summaryApproval, setSummaryApproval] = useState<Approval | null>(null);
  const [isActionsDialogOpen, setIsActionsDialogOpen] = useState(false);
  const [actionsApproval, setActionsApproval] = useState<Approval | null>(null);

  const { value: approvalApprovers } = useSelector((s: RootState) => (s as any).approvalApprovers) as { value: ApprovalApprover[] };
  const { value: statuses } = useSelector((s: RootState) => (s as any).statuses || { value: [] }) as { value: Status[] };
  const { value: customFields } = useSelector((s: RootState) => (s as any).customFields || { value: [] }) as { value: CustomField[] };
  const { value: priorities } = useSelector((s: RootState) => (s as any).priorities || { value: [] }) as {
    value: Array<{ id: number; name?: string; category_id?: number | null }>;
  };
  const { value: categories } = useSelector((s: RootState) => (s as any).categories || { value: [] }) as {
    value: Array<{ id: number; name?: string; approval_id?: number | null }>;
  };
  const { value: slas } = useSelector((s: RootState) => (s as any).slas || { value: [] }) as { value: Array<{ id: number; name?: string }> };
  const { value: users } = useSelector((s: RootState) => (s as any).users || { value: [] }) as { value: any[] };
  const { value: roles } = useSelector((s: RootState) => (s as any).roles || { value: [] }) as { value: any[] };
  const tasks = useSelector((s: any) => s?.tasks?.value || []) as any[];
  const { value: approvalsStateValue } = useSelector((s: RootState) => (s as any).approvals || { value: [] }) as { value: Approval[] };

  const approverCountByApproval = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of approvalApprovers || []) {
      const aid = Number((a as any)?.approval_id ?? (a as any)?.approvalId);
      if (!Number.isFinite(aid)) continue;
      map.set(aid, (map.get(aid) || 0) + 1);
    }
    return map;
  }, [approvalApprovers]);

  const conditionFieldOptions = useMemo(
    () =>
      buildConditionFieldOptions(statuses || [], customFields || [], ta, {
        priorities,
        categories,
        slas,
      }),
    [statuses, customFields, priorities, categories, slas, ta]
  );

  const openManageApprovers = useCallback((approval: Approval) => {
    setApproversApproval(approval);
    setIsApproversDialogOpen(true);
  }, []);

  const openManageActions = useCallback((approval: Approval) => {
    setActionsApproval(approval);
    setIsActionsDialogOpen(true);
  }, []);

  const openSummary = useCallback((approval: Approval) => {
    setSummaryApproval(approval);
    setIsSummaryDialogOpen(true);
  }, []);

  const orderedItems = useMemo(() => {
    return [...filteredItems].sort((a: any, b: any) => {
      const ao = Number(a?.order_index ?? 0);
      const bo = Number(b?.order_index ?? 0);
      if (ao !== bo) return ao - bo;
      return Number(a?.id ?? 0) - Number(b?.id ?? 0);
    });
  }, [filteredItems]);

  const colDefs: ColDef[] = useApprovalsColumnDefs({
    ta,
    renderDeadline,
    getTriggerTypeLabel,
    approverCountByApproval,
    openManageApprovers,
    openManageActions,
    openSummary,
  });

  const [createFormData, setCreateFormData] = useState<ApprovalFormState>(() => createEmptyFormState());
  const [editFormData, setEditFormData] = useState<ApprovalFormState>(() => createEmptyFormState());

  useEffect(() => {
    const item = editingItem as Approval | null;
    if (!item) return;
    setEditFormData({
      name: (item as any).name || "",
      description: (item as any).description || "",
      approval_type: ((item as any).approval_type as any) || "SEQUENTIAL",
      require_all: !!(item as any).require_all,
      minimum_approvals: (item as any).minimum_approvals ?? "",
      trigger_type: ((item as any).trigger_type as any) || "ON_CREATE",
      trigger_conditions: Array.isArray((item as any).trigger_conditions) ? (item as any).trigger_conditions : [],
      require_rejection_comment: !!(item as any).require_rejection_comment,
      block_editing_during_approval: !!(item as any).block_editing_during_approval,
      deadline_type: ((item as any).deadline_type as any) || "hours",
      deadline_value: (item as any).deadline_value || "",
      order_index: (item as any).order_index ?? 0,
      is_active: !!(item as any).is_active,
    });
  }, [editingItem]);

  const handleQuickEdit = useCallback(
    (item: Approval) => {
    if (!item) return;
    setEditFormData({
        name: (item as any).name || "",
        description: (item as any).description || "",
        approval_type: ((item as any).approval_type as any) || "SEQUENTIAL",
        require_all: !!(item as any).require_all,
        minimum_approvals: (item as any).minimum_approvals ?? "",
        trigger_type: ((item as any).trigger_type as any) || "ON_CREATE",
        trigger_conditions: Array.isArray((item as any).trigger_conditions) ? (item as any).trigger_conditions : [],
        require_rejection_comment: !!(item as any).require_rejection_comment,
        block_editing_during_approval: !!(item as any).block_editing_during_approval,
        deadline_type: ((item as any).deadline_type as any) || "hours",
        deadline_value: (item as any).deadline_value || "",
        order_index: (item as any).order_index ?? 0,
        is_active: !!(item as any).is_active,
    });
    setEditingItem(item);
    setIsEditDialogOpen(true);
    },
    [setEditingItem, setIsEditDialogOpen]
  );

  const openDeleteFromEdit = useCallback(() => {
    if (!editingItem) return;
    setIsEditDialogOpen(false);
    handleDelete(editingItem);
  }, [editingItem, handleDelete, setIsEditDialogOpen]);

  const handleRowDragEnd = useCallback(
    async (event: any) => {
    const api = event?.api;
    if (!api) return;
    const updates: Array<{ id: number; order_index: number }> = [];
    api.forEachNode((node: any, index: number) => {
      const id = Number(node?.data?.id);
      if (!Number.isFinite(id)) return;
      const current = Number(node?.data?.order_index ?? 0);
      if (current !== index) {
        updates.push({ id, order_index: index });
      }
    });
    if (!updates.length) return;
    // Apply sequentially to preserve order updates
    for (const u of updates) {
      await updateItem(u.id, { order_index: u.order_index } as any);
    }
    },
    [updateItem]
  );

  const getRowId = useCallback((params: any) => String(params?.data?.id ?? params?.id ?? ""), []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name.trim()) throw new Error(nameRequiredError);
    const maxOrder = Math.max(0, ...(approvalsStateValue || []).map((a: any) => Number(a?.order_index ?? 0)));
    const normalizedConditions =
      createFormData.trigger_type === "CONDITIONAL" ? sanitizeConditionsForSubmit(createFormData.trigger_conditions) : [];
    if (createFormData.trigger_type === "CONDITIONAL" && normalizedConditions.length === 0) {
      throw new Error(ta("conditions.errors.required", "Add at least one condition to use the conditional trigger."));
    }
    const payload: any = {
      name: createFormData.name.trim(),
      description: createFormData.description?.trim() || null,
      approval_type: createFormData.approval_type,
      require_all: !!createFormData.require_all,
      minimum_approvals: createFormData.require_all ? null : createFormData.minimum_approvals === "" ? null : Number(createFormData.minimum_approvals),
      trigger_type: createFormData.trigger_type,
      trigger_conditions: createFormData.trigger_type === "CONDITIONAL" ? normalizedConditions : null,
      require_rejection_comment: !!createFormData.require_rejection_comment,
      block_editing_during_approval: !!createFormData.block_editing_during_approval,
      deadline_type: createFormData.deadline_type,
      deadline_value: createFormData.deadline_value || null,
      order_index: maxOrder + 1,
      is_active: !!createFormData.is_active,
      deleted_at: null,
    };
    await createItem(payload);
    setCreateFormData(createEmptyFormState());
  };

  const handleEditSubmit = async (e: React.FormEvent, item?: Approval | null) => {
    e.preventDefault();
    if (!item) return;
    if (!editFormData.name.trim()) throw new Error(nameRequiredError);
    const normalizedConditions =
      editFormData.trigger_type === "CONDITIONAL" ? sanitizeConditionsForSubmit(editFormData.trigger_conditions) : [];
    if (editFormData.trigger_type === "CONDITIONAL" && normalizedConditions.length === 0) {
      throw new Error(ta("conditions.errors.required", "Add at least one condition to use the conditional trigger."));
    }
    const updates: any = {
      name: editFormData.name.trim(),
      description: editFormData.description?.trim() || null,
      approval_type: editFormData.approval_type,
      require_all: !!editFormData.require_all,
      minimum_approvals: editFormData.require_all ? null : editFormData.minimum_approvals === "" ? null : Number(editFormData.minimum_approvals),
      trigger_type: editFormData.trigger_type,
      trigger_conditions: editFormData.trigger_type === "CONDITIONAL" ? normalizedConditions : null,
      require_rejection_comment: !!editFormData.require_rejection_comment,
      block_editing_during_approval: !!editFormData.block_editing_during_approval,
      deadline_type: editFormData.deadline_type,
      deadline_value: editFormData.deadline_value || null,
      order_index: editFormData.order_index ?? (item as any).order_index ?? 0,
      is_active: !!editFormData.is_active,
    };
    await updateItem((item as any).id, updates);
  };

  return (
    <div className="p-4 pt-0 h-full">
      <SettingsLayout
        title={ta("title", "Approvals")}
        description={ta("description", "Configure task approvals")}
        icon={faSquareCheck}
        iconColor="#10b981"
        loading={{ isLoading: loading, message: ta("loading", "Loading approvals...") }}
        error={error ? { message: error, onRetry: () => window.location.reload() } : undefined}
        headerActions={
          <Button 
            size="default"
            className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98]"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            {ta("headerActions.add", "Add Approval")}
          </Button>
        }
      >
        <div className="flex h-full flex-col min-h-0">
          <UrlTabs
            className="flex-1 min-h-0"
            tabs={[
            {
              value: "approvals",
              label: (
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faSquareCheck} className="w-4 h-4" />
                    <span>{ta("tabs.approvals", "Approvals")}</span>
                </div>
              ),
              content: (
                <div className="flex h-full flex-col">
                  <div className="flex-1 min-h-0">
                    <SettingsGrid
                    rowData={orderedItems}
                      columnDefs={colDefs}
                        noRowsMessage={ta("grid.noRows", "No approvals found")}
                      rowSelection="single"
                      onRowDoubleClicked={(row: any) => handleQuickEdit(row?.data ?? row)}
                    onRowDragEnd={handleRowDragEnd}
                    getRowId={getRowId}
                    gridOptions={{
                      rowDragManaged: true,
                      suppressMoveWhenRowDragging: true,
                      animateRows: true,
                      rowDragMultiRow: false,
                    }}
                    />
                  </div>
                </div>
              ),
            },
              {
                value: "help",
                label: (
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCircleQuestion} className="w-4 h-4" />
                    <span>{ta("tabs.help", "Help & Documentation")}</span>
                  </div>
                ),
                content: <ApprovalsHelpTab />,
              },
            ]}
            defaultValue="approvals"
          />
        </div>
      </SettingsLayout>

      <CreateApprovalDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        formData={createFormData}
        setFormData={setCreateFormData}
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        conditionFieldOptions={conditionFieldOptions}
                  ta={ta}
                />

      <EditApprovalDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        formData={editFormData}
        setFormData={setEditFormData}
        onSubmit={(e) => handleEditSubmit(e, editingItem as any)}
        isSubmitting={isSubmitting}
        error={formError}
        editingItem={(editingItem as any) || null}
        onDeleteClick={openDeleteFromEdit}
        deleteDialogTitle={deleteDialogTitle}
        deleteSectionDescription={deleteSectionDescription}
        conditionFieldOptions={conditionFieldOptions}
                  ta={ta}
                />

      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title={deleteDialogTitle}
        description={deleteDescription}
        onConfirm={() => (deletingItem ? deleteItem((deletingItem as any).id) : undefined)}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!deletingItem}
        entityName={deleteEntityName}
        entityData={deletingItem}
        renderEntityPreview={(a: Approval) => (
          <div>
            <div className="font-medium">{(a as any).name}</div>
            {(a as any).description && <div className="text-sm text-muted-foreground">{(a as any).description}</div>}
            <div className="text-xs text-muted-foreground mt-1">
              {previewTypeLabel}: {getApprovalTypeLabel((a as any).approval_type)} • {previewTriggerLabel}: {getTriggerTypeLabel((a as any).trigger_type)}
            </div>
            {(a as any).trigger_type === "CONDITIONAL" &&
              Array.isArray((a as any).trigger_conditions) &&
              (a as any).trigger_conditions.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                  {previewConditionsLabel}: {(a as any).trigger_conditions.map((condition: any) => condition.label || condition.field).join(", ")}
              </div>
            )}
          </div>
        )}
      />

      <ApprovalApproversManager
        open={isApproversDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsApproversDialogOpen(false);
            setApproversApproval(null);
          } else {
            setIsApproversDialogOpen(true);
          }
        }}
        approval={approversApproval}
      />

      <ApprovalActionsDialog
        open={isActionsDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsActionsDialogOpen(false);
            setActionsApproval(null);
          } else {
            setIsActionsDialogOpen(true);
          }
        }}
        approval={actionsApproval}
      />

      <ApprovalSummaryDialog
        open={isSummaryDialogOpen}
        onOpenChange={setIsSummaryDialogOpen}
        summaryApproval={summaryApproval}
        setSummaryApproval={setSummaryApproval}
        approvalApprovers={approvalApprovers || []}
        users={users || []}
        roles={roles || []}
        tasks={tasks || []}
        ta={ta}
        renderDeadline={renderDeadline}
        getTriggerTypeLabel={getTriggerTypeLabel}
      />
    </div>
  );
}

export default Approvals;

