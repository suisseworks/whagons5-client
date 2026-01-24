import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTags,
  faPlus,
  faChartBar,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { RootState, AppDispatch } from "@/store/store";
import { genericActions } from '@/store/genericSlices';
import { Category, Task, Team, StatusTransitionGroup, Sla, Approval } from "@/store/types";
import { Button } from "@/components/ui/button";
import { UrlTabs } from "@/components/ui/url-tabs";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  IconPicker,
  CategoryFieldsManager,
  CategoryReportingTeamsManager,
  TextField,
  SelectField,
  CheckboxField
} from "../../components";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
import { useLanguage } from "@/providers/LanguageProvider";
import { celebrateTaskCompletion } from "@/utils/confetti";
import { CategoryFormData } from "./types";
import { useCategoryColumnDefs } from "./utils/columnDefs";
import { StatisticsTab, CategoryPreview } from "./components";

function Categories() {
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useLanguage();
  const tc = (key: string, fallback: string) => t(`settings.categories.${key}`, fallback);
  const { value: teams } = useSelector((state: RootState) => state.teams) as { value: Team[] };
  const { value: tasks } = useSelector((state: RootState) => state.tasks) as { value: Task[] };
  const { value: categoryCustomFields } = useSelector((state: RootState) => state.categoryCustomFields) as { value: any[] };
  const statusTransitionGroups = useSelector((s: RootState) => (s as any).statusTransitionGroups.value) as StatusTransitionGroup[];
  const slasState = useSelector((state: RootState) => (state as any).slas) as { value?: Sla[] } | undefined;
  const slas: Sla[] = slasState?.value ?? [];
  const approvalsState = useSelector((state: RootState) => (state as any).approvals) as { value?: Approval[] } | undefined;
  const approvals: Approval[] = approvalsState?.value ?? [];
  const workspacesState = useSelector((state: RootState) => (state as any).workspaces) as { value?: any[] } | undefined;
  const workspaces: any[] = workspacesState?.value ?? [];

  // Use shared state management
  const {
    items: categories,
    filteredItems,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    handleSearch,
    createItem,
    updateItem,
    deleteItem,
    isSubmitting,
    formError,
    setFormError,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDeleteDialogOpen,
    editingItem: editingCategory,
    deletingItem: deletingCategory,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<Category>({
    entityName: 'categories',
    searchFields: ['name', 'description']
  });

  // Form state for create dialog
  const [createFormData, setCreateFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    color: '#4ECDC4',
    icon: 'fas fa-tags',
    enabled: true,
    team_id: '',
    workspace_id: '',
    sla_id: '',
    approval_id: '',
    status_transition_group_id: '',
    celebration_effect: ''
  });

  // Form state for edit dialog
  const [editFormData, setEditFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    color: '#4ECDC4',
    icon: 'fas fa-tags',
    enabled: true,
    team_id: '',
    workspace_id: '',
    sla_id: '',
    approval_id: '',
    status_transition_group_id: '',
    celebration_effect: ''
  });

  // Reporting teams state
  const [savingReportingTeams, setSavingReportingTeams] = useState(false);
  const [reportingTeamsError, setReportingTeamsError] = useState<string | null>(null);
  const [selectedReportingTeamIds, setSelectedReportingTeamIds] = useState<number[]>([]);

  // Manage Fields dialog state
  const [isFieldsDialogOpen, setIsFieldsDialogOpen] = useState(false);
  const [fieldsCategory, setFieldsCategory] = useState<Category | null>(null);

  // Manage Reporting Teams dialog state
  const [isReportingTeamsDialogOpen, setIsReportingTeamsDialogOpen] = useState(false);
  const [reportingTeamsCategory, setReportingTeamsCategory] = useState<Category | null>(null);

  // Load reporting teams from category directly
  const loadReportingTeamsForEdit = useCallback(() => {
    if (!editingCategory) return;
    setSelectedReportingTeamIds(editingCategory.reporting_team_ids || []);
    setReportingTeamsError(null);
  }, [editingCategory]);

  // Update edit form data when editing category changes
  useEffect(() => {
    if (editingCategory) {
      setEditFormData({
        name: editingCategory.name || '',
        description: editingCategory.description || '',
        color: editingCategory.color || '#4ECDC4',
        icon: editingCategory.icon || 'fas fa-tags',
        enabled: editingCategory.enabled ?? true,
        team_id: editingCategory.team_id?.toString() || '',
        workspace_id: (editingCategory as any).workspace_id?.toString() || '',
        sla_id: editingCategory.sla_id?.toString() || '',
        approval_id: (editingCategory as any).approval_id?.toString?.() || '',
        status_transition_group_id: editingCategory.status_transition_group_id?.toString() || '',
        celebration_effect: editingCategory.celebration_effect || ''
      });
      loadReportingTeamsForEdit();
    }
  }, [editingCategory, loadReportingTeamsForEdit]);

  // Sync selectedReportingTeamIds when editingCategory changes
  useEffect(() => {
    if (editingCategory) {
      setSelectedReportingTeamIds(editingCategory.reporting_team_ids || []);
      setReportingTeamsError(null);
    }
  }, [editingCategory]);

  const assignmentCountByCategory = useMemo<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    (categoryCustomFields as any[]).forEach((a) => {
      const cid = Number((a as any)?.category_id ?? (a as any)?.categoryId);
      if (!Number.isFinite(cid)) return;
      map[cid] = (map[cid] || 0) + 1;
    });
    return map;
  }, [categoryCustomFields]);

  const openManageFields = (category: Category) => {
    setFieldsCategory(category);
    setIsFieldsDialogOpen(true);
  };

  const closeManageFields = () => {
    setIsFieldsDialogOpen(false);
    setFieldsCategory(null);
  };

  const openManageReportingTeams = (category: Category) => {
    setReportingTeamsCategory(category);
    setIsReportingTeamsDialogOpen(true);
  };

  const closeManageReportingTeams = () => {
    setIsReportingTeamsDialogOpen(false);
    setReportingTeamsCategory(null);
  };

  // Handle toggle team for reporting teams
  const handleToggleReportingTeam = (teamId: number) => {
    setSelectedReportingTeamIds(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        return [...prev, teamId];
      }
    });
  };

  // Save reporting teams
  const handleSaveReportingTeams = async () => {
    if (!editingCategory) return;
    setSavingReportingTeams(true);
    setReportingTeamsError(null);
    try {
      await dispatch(genericActions.categories.updateAsync({
        id: editingCategory.id,
        updates: { reporting_team_ids: selectedReportingTeamIds }
      })).unwrap();
    } catch (e: any) {
      console.error('Error saving reporting teams', e);
      setReportingTeamsError(e?.message || 'Failed to save reporting teams');
    } finally {
      setSavingReportingTeams(false);
    }
  };

  // Get task count for a category
  const getCategoryTaskCount = (categoryId: number) => {
    return tasks.filter((task: Task) => task.category_id === categoryId).length;
  };

  const canDeleteCategory = (category: Category) => {
    return getCategoryTaskCount(category.id) === 0;
  };

  const handleDeleteCategory = (category: Category) => {
    if (canDeleteCategory(category)) {
      deleteItem(category.id);
    } else {
      handleDelete(category);
    }
  };

  const handleDeleteFromEdit = () => {
    if (!editingCategory) return;
    setIsEditDialogOpen(false);
    handleDeleteCategory(editingCategory);
  };

  // Column definitions
  const colDefs = useCategoryColumnDefs({
    teams,
    slas,
    approvals,
    statusTransitionGroups,
    assignmentCountByCategory,
    onManageFields: openManageFields,
    translate: tc
  });

  // Form handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setFormError(null);

      if (!createFormData.team_id) {
        const errorMessage = tc('validation.teamRequired', 'Please select a team for this category.');
        setFormError(errorMessage);
        return;
      }
      
      // Determine status_transition_group_id - use selected one or default
      let statusTransitionGroupId: number;
      if (!createFormData.status_transition_group_id) {
        if (statusTransitionGroups.length === 0) {
          const errorMessage = tc('validation.transitionGroupNotAvailable', 'No status transition groups are available. Please create a status transition group first.');
          setFormError(errorMessage);
          return;
        }
        const defaultGroup = statusTransitionGroups.find((g: StatusTransitionGroup) => g.is_default);
        statusTransitionGroupId = defaultGroup ? defaultGroup.id : statusTransitionGroups[0].id;
      } else {
        statusTransitionGroupId = parseInt(createFormData.status_transition_group_id);
      }

      const categoryData = {
        name: createFormData.name,
        description: createFormData.description,
        color: createFormData.color,
        icon: createFormData.icon,
        enabled: createFormData.enabled,
        team_id: parseInt(createFormData.team_id),
        workspace_id: createFormData.workspace_id ? parseInt(createFormData.workspace_id) : 1,
        sla_id: createFormData.sla_id ? parseInt(createFormData.sla_id) : null,
        approval_id: createFormData.approval_id ? parseInt(createFormData.approval_id) : null,
        status_transition_group_id: statusTransitionGroupId,
        celebration_effect: createFormData.celebration_effect || null,
        deleted_at: null
      };
      await createItem(categoryData);

      // Reset form after successful creation
      setCreateFormData({
        name: '',
        description: '',
        color: '#4ECDC4',
        icon: 'fas fa-tags',
        enabled: true,
        team_id: '',
        workspace_id: '',
        sla_id: '',
        approval_id: '',
        status_transition_group_id: '',
        celebration_effect: ''
      });
    } catch (err: any) {
      const errorMessage = err?.message || tc('validation.genericError', 'An error occurred while creating the category.');
      setFormError(errorMessage);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    const updates = {
      name: editFormData.name,
      description: editFormData.description,
      color: editFormData.color,
      icon: editFormData.icon,
      enabled: editFormData.enabled,
      team_id: editFormData.team_id ? parseInt(editFormData.team_id) : 0,
      workspace_id: editFormData.workspace_id ? parseInt(editFormData.workspace_id) : 1,
      sla_id: editFormData.sla_id ? parseInt(editFormData.sla_id) : null,
      approval_id: editFormData.approval_id ? parseInt(editFormData.approval_id) : null,
      status_transition_group_id: editFormData.status_transition_group_id ? parseInt(editFormData.status_transition_group_id) : undefined,
      reporting_team_ids: selectedReportingTeamIds,
      celebration_effect: editFormData.celebration_effect || null
    };
    await updateItem(editingCategory.id, updates);
  };

  // Render entity preview for delete dialog
  const renderCategoryPreview = (category: Category) => {
    return (
      <CategoryPreview
        category={category}
        teams={teams}
        getCategoryTaskCount={getCategoryTaskCount}
        translate={tc}
      />
    );
  };

  return (
    <SettingsLayout
      title={tc('title', 'Categories')}
      description={tc('description', 'Manage task categories and labels for better organization')}
      icon={faTags}
      iconColor="#ef4444"
      loading={{
        isLoading: loading,
        message: tc('loading', 'Loading categories...')
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      headerActions={
        <div className="flex items-center space-x-2">
          <Link to="/settings/categories/custom-fields">
            <Button variant="outline" className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring">
              {tc('header.manageFields', 'Manage custom fields')}
            </Button>
          </Link>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            size="default"
            className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98]"
          >
            <FontAwesomeIcon icon={faPlus} className="w-4 h-4 mr-2" />
            <span>{tc('header.addCategory', 'Add Category')}</span>
          </Button>
        </div>
      }
    >
      <UrlTabs
        tabs={[
          {
            value: "categories",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faTags} className="w-4 h-4" />
                <span>{tc('tabs.categories', 'Categories')}</span>
              </div>
            ),
            content: (
              <div className="flex h-full flex-col">
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder={tc('search.placeholder', 'Search categories...')}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleSearch(e.target.value);
                    }}
                    className="w-full max-w-md px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
                <div className="flex-1 min-h-0">
                  <SettingsGrid
                    rowData={filteredItems}
                    columnDefs={colDefs}
                    noRowsMessage={tc('grid.noRows', 'No categories found')}
                    rowSelection="single"
                    onRowDoubleClicked={(row: any) => handleEdit(row)}
                    gridOptions={{
                      getRowStyle: (params: any) => {
                        const isEnabled = Boolean(params?.data?.enabled);
                        if (!isEnabled) {
                          return { opacity: 0.6 } as any;
                        }
                        return undefined as any;
                      }
                    }}
                  />
                </div>
              </div>
            )
          },
          {
            value: "statistics",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faChartBar} className="w-4 h-4" />
                <span>{tc('tabs.statistics', 'Statistics')}</span>
              </div>
            ),
            content: (
              <StatisticsTab
                categories={categories}
                tasks={tasks}
                teams={teams}
                translate={tc}
              />
            )
          }
        ]}
        defaultValue="categories"
        basePath="/settings/categories"
        className="h-full flex flex-col"
      />

      {/* Create Category Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title={tc('dialogs.create.title', 'Add New Category')}
        description={tc('dialogs.create.description', 'Add a new category to organize your tasks.')}
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="rounded-xl bg-gradient-to-r from-sky-50 via-white to-emerald-50 dark:from-sky-900/30 dark:via-slate-900 dark:to-emerald-900/20 border border-sky-100 dark:border-slate-800 px-4 py-3 mb-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-sky-100 dark:border-slate-700 flex items-center justify-center">
            <FontAwesomeIcon icon={faTags} className="text-sky-600 dark:text-sky-300 w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{tc('dialogs.create.helper.title', 'Create category')}</p>
            <p className="text-xs text-muted-foreground">
              {tc('dialogs.create.helper.description', 'Set general details and rules (SLA, approval, transitions) across two tabs.')}
            </p>
          </div>
        </div>
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">{tc('dialogs.create.tabs.general', 'General')}</TabsTrigger>
            <TabsTrigger value="rules">{tc('dialogs.create.tabs.rules', 'Rules')}</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="grid gap-4 min-h-[320px]">
              <TextField
                id="name"
                label={tc('fields.name', 'Name')}
                value={createFormData.name}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, name: value }))}
                required
              />
              <TextField
                id="description"
                label={tc('fields.description', 'Description')}
                value={createFormData.description}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, description: value }))}
              />
              <TextField
                id="color"
                label={tc('fields.color', 'Color')}
                type="color"
                value={createFormData.color}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, color: value }))}
              />
              <IconPicker
                id="icon"
                label={tc('fields.icon', 'Icon')}
                value={createFormData.icon}
                onChange={(iconClass) => setCreateFormData(prev => ({ ...prev, icon: iconClass }))}
                color={createFormData.color}
                required
              />
              <SelectField
                id="team"
                label={tc('fields.team', 'Team')}
                value={createFormData.team_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, team_id: value }))}
                placeholder={tc('fields.placeholders.noTeam', 'No Team')}
                options={teams.map((team: Team) => ({
                  value: team.id.toString(),
                  label: team.name
                }))}
                required
              />
              <SelectField
                id="workspace"
                label={tc('fields.workspace', 'Workspace')}
                value={createFormData.workspace_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, workspace_id: value }))}
                placeholder={tc('fields.placeholders.selectWorkspace', 'Select Workspace')}
                options={(workspaces as any[]).filter((w: any) => w.type === 'DEFAULT').map((workspace: any) => ({
                  value: workspace.id.toString(),
                  label: workspace.name
                }))}
                required
              />
              <CheckboxField
                id="enabled"
                label={tc('fields.status', 'Status')}
                checked={createFormData.enabled}
                onChange={(checked) => setCreateFormData(prev => ({ ...prev, enabled: checked }))}
                description={tc('fields.enabled', 'Enabled')}
              />
            </div>
          </TabsContent>
          <TabsContent value="rules">
            <div className="grid gap-4 min-h-[320px]">
              <SelectField
                id="sla"
                label={tc('fields.sla', 'SLA')}
                value={createFormData.sla_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, sla_id: value === 'none' ? '' : value }))}
                placeholder={tc('fields.placeholders.selectSla', 'Select SLA…')}
                options={[{ value: 'none', label: tc('fields.placeholders.none', 'None') }, ...(slas as Sla[]).map((s: Sla) => ({
                  value: s.id.toString(),
                  label: s.name
                }))]}
              />
              <SelectField
                id="approval"
                label={tc('fields.approval', 'Approval')}
                value={createFormData.approval_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, approval_id: value === 'none' ? '' : value }))}
                placeholder={tc('fields.placeholders.selectApproval', 'Select approval…')}
                options={[{ value: 'none', label: tc('fields.placeholders.none', 'None') }, ...(approvals as Approval[]).map((a: Approval) => ({
                  value: a.id.toString(),
                  label: a.name
                }))]}
              />
              <SelectField
                id="status-group"
                label={tc('fields.statusTransitionGroup', 'Status Transition Group')}
                value={createFormData.status_transition_group_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, status_transition_group_id: value }))}
                placeholder={tc('fields.placeholders.selectGroup', 'Select group…')}
                options={statusTransitionGroups.map((g: StatusTransitionGroup) => ({
                  value: g.id.toString(),
                  label: g.name
                }))}
                required
              />
              <SelectField
                id="celebration-effect"
                label={tc('fields.celebrationEffect', 'Task Completion Celebration')}
                value={createFormData.celebration_effect}
                onChange={(value) => {
                  setCreateFormData(prev => ({ ...prev, celebration_effect: value === 'default' ? '' : value }));
                  celebrateTaskCompletion(value === 'default' ? null : value);
                }}
                placeholder={tc('fields.placeholders.selectCelebration', 'Select celebration…')}
                options={[
                  { value: 'default', label: tc('fields.placeholders.useGlobalDefault', 'Use Global Default') },
                  { value: 'confetti', label: tc('fields.celebration.confetti', 'Confetti') },
                  { value: 'fireworks', label: tc('fields.celebration.fireworks', 'Fireworks') },
                  { value: 'hearts', label: tc('fields.celebration.hearts', 'Hearts') },
                  { value: 'balloons', label: tc('fields.celebration.balloons', 'Balloons') },
                  { value: 'sparkles', label: tc('fields.celebration.sparkles', 'Sparkles') },
                  { value: 'ribbons', label: tc('fields.celebration.ribbons', 'Ribbons') },
                  { value: 'none', label: tc('fields.celebration.none', 'None') }
                ]}
              />
            </div>
          </TabsContent>
        </Tabs>
      </SettingsDialog>

      {/* Edit Category Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        type="edit"
        title={tc('dialogs.edit.title', 'Edit Category')}
        description={tc('dialogs.edit.description', 'Update the category information.')}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingCategory}
        footerActions={
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={handleDeleteFromEdit}
            disabled={!editingCategory}
            title={tc('dialogs.delete.button', 'Delete')}
            aria-label={tc('dialogs.delete.button', 'Delete')}
          >
            <FontAwesomeIcon icon={faTrash} />
          </Button>
        }
      >
        <div className="rounded-xl bg-gradient-to-r from-sky-50 via-white to-emerald-50 dark:from-sky-900/30 dark:via-slate-900 dark:to-emerald-900/20 border border-sky-100 dark:border-slate-800 px-4 py-3 mb-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-sky-100 dark:border-slate-700 flex items-center justify-center">
            <FontAwesomeIcon icon={faTags} className="text-sky-600 dark:text-sky-300 w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{tc('dialogs.edit.helper.title', 'Edit category')}</p>
            <p className="text-xs text-muted-foreground">
              {tc('dialogs.edit.helper.description', 'Update details and rules. SLA, approval, and transitions live in the Rules tab.')}
            </p>
          </div>
        </div>
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">{tc('dialogs.edit.tabs.general', 'General')}</TabsTrigger>
            <TabsTrigger value="rules">{tc('dialogs.edit.tabs.rules', 'Rules')}</TabsTrigger>
            <TabsTrigger value="reporting-teams">{tc('dialogs.edit.tabs.reportingTeams', 'Reporting Teams')}</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="grid gap-4 min-h-[320px]">
              <TextField
                id="edit-name"
                label={tc('fields.name', 'Name')}
                value={editFormData.name}
                onChange={(value) => setEditFormData(prev => ({ ...prev, name: value }))}
                required
              />
              <TextField
                id="edit-description"
                label={tc('fields.description', 'Description')}
                value={editFormData.description}
                onChange={(value) => setEditFormData(prev => ({ ...prev, description: value }))}
              />
              <TextField
                id="edit-color"
                label={tc('fields.color', 'Color')}
                type="color"
                value={editFormData.color}
                onChange={(value) => setEditFormData(prev => ({ ...prev, color: value }))}
              />
              <IconPicker
                id="edit-icon"
                label={tc('fields.icon', 'Icon')}
                value={editFormData.icon}
                onChange={(iconClass) => setEditFormData(prev => ({ ...prev, icon: iconClass }))}
                color={editFormData.color}
                required
              />
              <SelectField
                id="edit-team"
                label={tc('fields.team', 'Team')}
                value={editFormData.team_id}
                onChange={(value) => setEditFormData(prev => ({ ...prev, team_id: value }))}
                placeholder={tc('fields.placeholders.noTeam', 'No Team')}
                options={teams.map((team: Team) => ({
                  value: team.id.toString(),
                  label: team.name
                }))}
              />
              <SelectField
                id="edit-workspace"
                label={tc('fields.workspace', 'Workspace')}
                value={editFormData.workspace_id}
                onChange={(value) => setEditFormData(prev => ({ ...prev, workspace_id: value }))}
                placeholder={tc('fields.placeholders.selectWorkspace', 'Select Workspace')}
                options={(workspaces as any[]).filter((w: any) => w.type === 'DEFAULT').map((workspace: any) => ({
                  value: workspace.id.toString(),
                  label: workspace.name
                }))}
                required
              />
              <CheckboxField
                id="edit-enabled"
                label={tc('fields.status', 'Status')}
                checked={editFormData.enabled}
                onChange={(checked) => setEditFormData(prev => ({ ...prev, enabled: checked }))}
                description={tc('fields.enabled', 'Enabled')}
              />
            </div>
          </TabsContent>
          <TabsContent value="rules">
            <div className="grid gap-4 min-h-[320px]">
              <SelectField
                id="edit-sla"
                label={tc('fields.sla', 'SLA')}
                value={editFormData.sla_id}
                onChange={(value) => setEditFormData(prev => ({ ...prev, sla_id: value === 'none' ? '' : value }))}
                placeholder={tc('fields.placeholders.selectSla', 'Select SLA…')}
                options={[{ value: 'none', label: tc('fields.placeholders.none', 'None') }, ...(slas as Sla[]).map((s: Sla) => ({
                  value: s.id.toString(),
                  label: s.name
                }))]}
              />
              <SelectField
                id="edit-approval"
                label={tc('fields.approval', 'Approval')}
                value={editFormData.approval_id}
                onChange={(value) => setEditFormData(prev => ({ ...prev, approval_id: value === 'none' ? '' : value }))}
                placeholder={tc('fields.placeholders.selectApproval', 'Select approval…')}
                options={[{ value: 'none', label: tc('fields.placeholders.none', 'None') }, ...(approvals as Approval[]).map((a: Approval) => ({
                  value: a.id.toString(),
                  label: a.name
                }))]}
              />
              <SelectField
                id="edit-status-group"
                label={tc('fields.statusTransitionGroup', 'Status Transition Group')}
                value={editFormData.status_transition_group_id}
                onChange={(value) => setEditFormData(prev => ({ ...prev, status_transition_group_id: value }))}
                placeholder={tc('fields.placeholders.selectGroup', 'Select group…')}
                options={statusTransitionGroups.map((g: StatusTransitionGroup) => ({
                  value: g.id.toString(),
                  label: g.name
                }))}
                required
              />
              <SelectField
                id="edit-celebration-effect"
                label={tc('fields.celebrationEffect', 'Task Completion Celebration')}
                value={editFormData.celebration_effect}
                onChange={(value) => {
                  setEditFormData(prev => ({ ...prev, celebration_effect: value === 'default' ? '' : value }));
                  celebrateTaskCompletion(value === 'default' ? null : value);
                }}
                placeholder={tc('fields.placeholders.selectCelebration', 'Select celebration…')}
                options={[
                  { value: 'default', label: tc('fields.placeholders.useGlobalDefault', 'Use Global Default') },
                  { value: 'confetti', label: tc('fields.celebration.confetti', 'Confetti') },
                  { value: 'fireworks', label: tc('fields.celebration.fireworks', 'Fireworks') },
                  { value: 'hearts', label: tc('fields.celebration.hearts', 'Hearts') },
                  { value: 'balloons', label: tc('fields.celebration.balloons', 'Balloons') },
                  { value: 'sparkles', label: tc('fields.celebration.sparkles', 'Sparkles') },
                  { value: 'ribbons', label: tc('fields.celebration.ribbons', 'Ribbons') },
                  { value: 'none', label: tc('fields.celebration.none', 'None') }
                ]}
              />
            </div>
          </TabsContent>
          <TabsContent value="reporting-teams">
            <CategoryReportingTeamsManager
              variant="inline"
              category={editingCategory}
              selectedTeamIds={selectedReportingTeamIds}
              onToggleTeam={handleToggleReportingTeam}
              saving={savingReportingTeams}
              error={reportingTeamsError}
              onSave={handleSaveReportingTeams}
              onReset={loadReportingTeamsForEdit}
              teams={teams}
              hideFooter={true}
            />
          </TabsContent>
        </Tabs>
      </SettingsDialog>

      {/* Delete Category Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title={tc('dialogs.delete.title', 'Delete Category')}
        description={
          deletingCategory ? (() => {
            const taskCount = getCategoryTaskCount(deletingCategory.id);
            
            if (taskCount > 0) {
              return tc('dialogs.delete.restricted', 'This category cannot be deleted because it contains {count} task{plural}. Please reassign or delete all tasks in this category first.')
                .replace('{count}', String(taskCount))
                .replace('{plural}', taskCount !== 1 ? 's' : '');
            } else {
              const hasWorkspace = deletingCategory.workspace_id;
              const baseMessage = tc('dialogs.delete.confirm', 'Are you sure you want to delete the category "{name}"? This action cannot be undone.')
                .replace('{name}', deletingCategory.name);
              
              if (hasWorkspace) {
                const workspaceWarning = tc('dialogs.delete.workspaceWarning', ' Note: The associated workspace will also be deleted.');
                return baseMessage + workspaceWarning;
              }
              
              return baseMessage;
            }
          })() : undefined
        }
        onConfirm={() => deletingCategory && canDeleteCategory(deletingCategory) ? deleteItem(deletingCategory.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!deletingCategory || !canDeleteCategory(deletingCategory)}
        entityName="category"
        entityData={deletingCategory}
        renderEntityPreview={renderCategoryPreview}
      />

      {/* Manage Fields Dialog */}
      <CategoryFieldsManager
        open={isFieldsDialogOpen}
        onOpenChange={(open) => { if (!open) closeManageFields(); }}
        category={fieldsCategory}
      />
      <CategoryReportingTeamsManager
        open={isReportingTeamsDialogOpen}
        onOpenChange={(open) => { if (!open) closeManageReportingTeams(); }}
        category={reportingTeamsCategory}
      />
    </SettingsLayout>
  );
}

export default Categories;
