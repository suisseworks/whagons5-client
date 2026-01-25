import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBriefcase, faPlus, faChartBar, faTrash } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/providers/LanguageProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UrlTabs } from "@/components/ui/url-tabs";
import { AppDispatch } from "@/store/store";
import type { JobPosition, JobPositionLevel } from "@/store/types";
import { genericActions } from "@/store/genericSlices";
import {
	SettingsLayout,
	SettingsGrid,
	SettingsDialog,
	useSettingsState,
	createActionsCellRenderer,
	BooleanBadgeCellRenderer,
	TextField,
	TextAreaField,
	SelectField,
	CheckboxField
} from "../../components";

type JobPositionFormState = {
	code: string;
	title: string;
	level: JobPositionLevel;
	description: string;
	is_leadership: boolean;
	is_active: boolean;
};

const LEVEL_OPTIONS: { value: JobPositionLevel; label: string }[] = [
	{ value: "executive", label: "Executive" },
	{ value: "director", label: "Director" },
	{ value: "manager", label: "Manager" },
	{ value: "senior", label: "Senior" },
	{ value: "junior", label: "Junior" }
];

const DEFAULT_LEVEL: JobPositionLevel = "manager";

const levelBadgeClasses: Record<JobPositionLevel | "other", string> = {
	executive: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-50",
	director: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-50",
	manager: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-50",
	senior: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-50",
	junior: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-50",
	other: "bg-muted text-muted-foreground"
};

const formatLevelLabel = (level?: string | null): string => {
	if (!level) return "Unspecified";
	const normalized = level.toLowerCase() as JobPositionLevel;
	const option = LEVEL_OPTIONS.find((opt) => opt.value === normalized);
	if (option) return option.label;
	return level.charAt(0).toUpperCase() + level.slice(1);
};

const LevelBadge = ({ level }: { level?: string | null }) => {
	const normalized = level?.toLowerCase() as JobPositionLevel | undefined;
	const key = normalized && levelBadgeClasses[normalized] ? normalized : "other";
	return (
		<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${levelBadgeClasses[key]}`}>
			{formatLevelLabel(level)}
		</span>
	);
};

const createDefaultFormState = (): JobPositionFormState => ({
	code: "",
	title: "",
	level: DEFAULT_LEVEL,
	description: "",
	is_leadership: false,
	is_active: true
});

function JobPositions() {
	const dispatch = useDispatch<AppDispatch>();
	const { t } = useLanguage();

	const {
		items,
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
		isCreateDialogOpen,
		setIsCreateDialogOpen,
		isEditDialogOpen,
		setIsEditDialogOpen,
		isDeleteDialogOpen,
		editingItem,
		deletingItem,
		handleEdit,
		handleDelete,
		handleCloseDeleteDialog
	} = useSettingsState<JobPosition>({
		entityName: "jobPositions",
		searchFields: ["code", "title"]
	});

	const [createFormData, setCreateFormData] = useState<JobPositionFormState>(createDefaultFormState);
	const [editFormData, setEditFormData] = useState<JobPositionFormState>(createDefaultFormState);

	useEffect(() => {
		if (!isCreateDialogOpen) {
			setCreateFormData(createDefaultFormState());
		}
	}, [isCreateDialogOpen]);

	useEffect(() => {
		if (editingItem) {
			setEditFormData({
				code: editingItem.code || "",
				title: editingItem.title || "",
				level: editingItem.level || DEFAULT_LEVEL,
				description: editingItem.description || "",
				is_leadership: !!editingItem.is_leadership,
				is_active: !!editingItem.is_active
			});
		} else {
			setEditFormData(createDefaultFormState());
		}
	}, [editingItem]);

	const columns = useMemo<ColDef<JobPosition>[]>(() => [
		{
			field: "code",
			headerName: t("settings.jobPositions.grid.columns.code", "Code"),
			minWidth: 140,
			flex: 1
		},
		{
			field: "title",
			headerName: t("settings.jobPositions.grid.columns.title", "Title"),
			minWidth: 220,
			flex: 2
		},
		{
			field: "level",
			headerName: t("settings.jobPositions.grid.columns.level", "Level"),
			minWidth: 160,
			flex: 1,
			cellRenderer: (params: ICellRendererParams<JobPosition>) => <LevelBadge level={params.value} />
		},
		{
			field: "is_leadership",
			headerName: t("settings.jobPositions.grid.columns.leadership", "Leadership"),
			minWidth: 150,
			cellRenderer: (params: ICellRendererParams<JobPosition>) => (
				<BooleanBadgeCellRenderer
					value={!!params.value}
					trueText={t("settings.jobPositions.grid.values.leadership", "Leadership")}
					falseText={t("settings.jobPositions.grid.values.individual", "Individual")}
					trueVariant="default"
					falseVariant="secondary"
				/>
			)
		},
		{
			field: "is_active",
			headerName: t("settings.jobPositions.grid.columns.status", "Status"),
			minWidth: 130,
			cellRenderer: (params: ICellRendererParams<JobPosition>) => (
				<BooleanBadgeCellRenderer
					value={!!params.value}
					trueText={t("settings.jobPositions.grid.values.active", "Active")}
					falseText={t("settings.jobPositions.grid.values.inactive", "Inactive")}
					trueVariant="default"
					falseVariant="secondary"
				/>
			)
		},
		{
			field: "description",
			headerName: t("settings.jobPositions.grid.columns.description", "Description"),
			flex: 3,
			minWidth: 260,
			valueGetter: (params) => params.data?.description || "—",
			cellRenderer: (params: ICellRendererParams<JobPosition>) => (
				<span className="text-sm text-muted-foreground block truncate" title={params.value as string}>
					{params.value || "—"}
				</span>
			)
		},
		{
			field: "actions",
			headerName: t("settings.jobPositions.grid.columns.actions", "Actions"),
			width: 110,
			pinned: "right",
			cellRenderer: () => null,
			sortable: false,
			filter: false,
			resizable: false
		}
	], [t]);

	const stats = useMemo(() => {
		const total = items.length;
		const active = items.filter((item) => item.is_active).length;
		const inactive = total - active;
		const leadership = items.filter((item) => item.is_leadership).length;
		const individual = total - leadership;

		const levelCounts = LEVEL_OPTIONS.reduce<Record<JobPositionLevel, number>>((acc, option) => {
			acc[option.value] = 0;
			return acc;
		}, {} as Record<JobPositionLevel, number>);

		items.forEach((item) => {
			const normalized = item.level?.toLowerCase() as JobPositionLevel;
			if (normalized && levelCounts[normalized] !== undefined) {
				levelCounts[normalized] += 1;
			}
		});

		return {
			total,
			active,
			inactive,
			leadership,
			individual,
			levelCounts
		};
	}, [items]);

	const levelDistribution = useMemo(
		() => LEVEL_OPTIONS.map((option) => ({
			label: option.label,
			count: stats.levelCounts[option.value] || 0,
			value: option.value
		})),
		[stats.levelCounts]
	);

	const handleCreateSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const payload: Omit<JobPosition, "id" | "created_at" | "updated_at"> = {
			code: createFormData.code.trim(),
			title: createFormData.title.trim(),
			level: createFormData.level,
			description: createFormData.description.trim() ? createFormData.description.trim() : null,
			is_leadership: createFormData.is_leadership,
			is_active: createFormData.is_active
		};
		await createItem(payload as any);
		setCreateFormData(createDefaultFormState());
	};

	const handleEditSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!editingItem) return;
		const updates: Partial<JobPosition> = {
			code: editFormData.code.trim(),
			title: editFormData.title.trim(),
			level: editFormData.level,
			description: editFormData.description.trim() ? editFormData.description.trim() : null,
			is_leadership: editFormData.is_leadership,
			is_active: editFormData.is_active
		};
		await updateItem(editingItem.id, updates);
	};

	const handleDeleteConfirm = async () => {
		if (!deletingItem) return;
		await deleteItem(deletingItem.id);
	};

	return (
		<SettingsLayout
			title={t("settings.jobPositions.title", "Job Positions")}
			description={t("settings.jobPositions.description", "Standardize role titles for reporting, permissions, and analytics.")}
			icon={faBriefcase}
			iconColor="#2563eb"
			backPath="/settings"
			loading={{ isLoading: loading, message: t("settings.jobPositions.loading", "Loading job positions...") }}
			error={error ? { message: error, onRetry: () => window.location.reload() } : undefined}
			headerActions={(
				<Button 
					size="default"
					className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98]"
					onClick={() => setIsCreateDialogOpen(true)}
				>
					<FontAwesomeIcon icon={faPlus} className="mr-2" />
					{t("settings.jobPositions.header.addJobPosition", "Add Job Position")}
				</Button>
			)}
		>
			<UrlTabs
				tabs={[
					{
						value: "positions",
						label: (
							<div className="flex items-center gap-2">
								<FontAwesomeIcon icon={faBriefcase} className="w-4 h-4" />
								<span>{t("settings.jobPositions.tabs.positions", "Positions")}</span>
							</div>
						),
						content: (
							<div className="flex h-full flex-col">
								<div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
									<input
										type="text"
										placeholder={t("settings.jobPositions.search.placeholder", "Search by code or title...")}
										value={searchQuery}
										onChange={(e) => {
											setSearchQuery(e.target.value);
											handleSearch(e.target.value);
										}}
										className="w-full md:w-80 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
									/>
									<p className="text-xs text-muted-foreground">
										{t("settings.jobPositions.grid.showing", "Showing {count} of {total} positions")
											.replace("{count}", String(filteredItems.length))
											.replace("{total}", String(items.length))}
									</p>
								</div>
								<div className="flex-1 min-h-0">
									<SettingsGrid
										rowData={filteredItems}
										columnDefs={columns}
										onRowClicked={handleEdit}
										noRowsMessage={t("settings.jobPositions.grid.noRows", "No job positions found")}
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
								<span>{t("settings.jobPositions.tabs.statistics", "Statistics")}</span>
							</div>
						),
						content: (
							<div className="flex-1 min-h-0 overflow-auto">
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
									<Card>
										<CardHeader className="py-2">
											<CardTitle className="text-sm">{t("settings.jobPositions.stats.overview.title", "Overview")}</CardTitle>
											<CardDescription className="text-xs">{t("settings.jobPositions.stats.overview.description", "Snapshot of your catalog")}</CardDescription>
										</CardHeader>
										<CardContent className="py-2">
											<div className="grid grid-cols-2 gap-3 text-center">
												<div>
													<div className="text-lg font-semibold">{stats.total}</div>
													<div className="text-[11px] text-muted-foreground">{t("settings.jobPositions.stats.total", "Total")}</div>
												</div>
												<div>
													<div className="text-lg font-semibold">{stats.active}</div>
													<div className="text-[11px] text-muted-foreground">{t("settings.jobPositions.stats.active", "Active")}</div>
												</div>
												<div>
													<div className="text-lg font-semibold">{stats.leadership}</div>
													<div className="text-[11px] text-muted-foreground">{t("settings.jobPositions.stats.leadership", "Leadership")}</div>
												</div>
												<div>
													<div className="text-lg font-semibold">{stats.individual}</div>
													<div className="text-[11px] text-muted-foreground">{t("settings.jobPositions.stats.individual", "Individual")}</div>
												</div>
											</div>
										</CardContent>
									</Card>
									<Card className="md:col-span-1 lg:col-span-2">
										<CardHeader className="py-2">
											<CardTitle className="text-sm">{t("settings.jobPositions.stats.levelDistribution.title", "Level Distribution")}</CardTitle>
										</CardHeader>
										<CardContent className="py-2">
											<div className="space-y-3">
												{levelDistribution.map((level) => (
													<div key={level.value} className="flex items-center justify-between text-sm">
														<div className="flex items-center gap-2">
															<Badge className={levelBadgeClasses[level.value]}>
																{level.label}
															</Badge>
														</div>
														<span className="font-semibold text-xs">{level.count}</span>
													</div>
												))}
												{stats.inactive > 0 && (
													<div className="flex items-center justify-between text-sm pt-1 border-t border-border">
														<span className="text-muted-foreground text-xs">{t("settings.jobPositions.stats.inactive", "Inactive roles")}</span>
														<span className="font-semibold text-xs">{stats.inactive}</span>
													</div>
												)}
											</div>
										</CardContent>
									</Card>
								</div>
							</div>
						)
					}
				]}
				defaultValue="positions"
				basePath="/settings/job-positions"
				className="h-full flex flex-col"
			/>

			<SettingsDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				type="create"
				title={t("settings.jobPositions.dialogs.create.title", "Add Job Position")}
				description={t("settings.jobPositions.dialogs.create.description", "Define a reusable job position for assignments and reporting.")}
				onSubmit={handleCreateSubmit}
				isSubmitting={isSubmitting}
				error={formError}
				submitDisabled={isSubmitting}
			>
				<div className="grid gap-4">
					<TextField
						id="create-code"
						label={t("settings.jobPositions.dialogs.create.fields.code", "Code")}
						value={createFormData.code}
						onChange={(value) => setCreateFormData((prev) => ({ ...prev, code: value }))}
						placeholder={t("settings.jobPositions.dialogs.create.fields.codePlaceholder", "e.g., OPS-MGR")}
						required
					/>
					<TextField
						id="create-title"
						label={t("settings.jobPositions.dialogs.create.fields.title", "Title")}
						value={createFormData.title}
						onChange={(value) => setCreateFormData((prev) => ({ ...prev, title: value }))}
						placeholder={t("settings.jobPositions.dialogs.create.fields.titlePlaceholder", "Operations Manager")}
						required
					/>
					<SelectField
						id="create-level"
						label={t("settings.jobPositions.dialogs.create.fields.level", "Level")}
						value={createFormData.level}
						onChange={(value) => setCreateFormData((prev) => ({ ...prev, level: value as JobPositionLevel }))}
						options={LEVEL_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
						required
					/>
					<div className="grid gap-2 sm:grid-cols-2">
						<CheckboxField
							id="create-is-leadership"
							label={t("settings.jobPositions.dialogs.create.fields.leadership", "Leadership Role")}
							checked={createFormData.is_leadership}
							onChange={(checked) => setCreateFormData((prev) => ({ ...prev, is_leadership: !!checked }))}
							description={t("settings.jobPositions.dialogs.create.fields.leadershipDescription", "Marks the position as part of management.")}
							hideFieldLabel={true}
						/>
						<CheckboxField
							id="create-is-active"
							label={t("settings.jobPositions.dialogs.create.fields.active", "Active")}
							checked={createFormData.is_active}
							onChange={(checked) => setCreateFormData((prev) => ({ ...prev, is_active: !!checked }))}
							description={t("settings.jobPositions.dialogs.create.fields.activeDescription", "Inactive roles remain in history but can't be assigned.")}
							hideFieldLabel={true}
						/>
					</div>
					<TextAreaField
						id="create-description"
						label={t("settings.jobPositions.dialogs.create.fields.description", "Description")}
						value={createFormData.description}
						onChange={(value) => setCreateFormData((prev) => ({ ...prev, description: value }))}
						placeholder={t("settings.jobPositions.dialogs.create.fields.descriptionPlaceholder", "Optional summary of responsibilities and scope.")}
						rows={3}
					/>
				</div>
			</SettingsDialog>

			<SettingsDialog
				open={isEditDialogOpen}
				onOpenChange={setIsEditDialogOpen}
				type="edit"
				title={t("settings.jobPositions.dialogs.edit.title", "Edit Job Position")}
				description={t("settings.jobPositions.dialogs.edit.description", "Update the selected job position.")}
				onSubmit={handleEditSubmit}
				isSubmitting={isSubmitting}
				error={formError}
				submitDisabled={isSubmitting || !editingItem}
				footerActions={
					editingItem ? (
						<Button
							type="button"
							variant="destructive"
							size="icon"
							onClick={() => {
								setIsEditDialogOpen(false);
								handleDelete(editingItem);
							}}
							disabled={isSubmitting}
							title={t("settings.jobPositions.dialogs.edit.delete", "Delete")}
							aria-label={t("settings.jobPositions.dialogs.edit.delete", "Delete")}
						>
							<FontAwesomeIcon icon={faTrash} />
						</Button>
					) : null
				}
			>
				{editingItem && (
					<div className="grid gap-4">
						<TextField
							id="edit-code"
							label={t("settings.jobPositions.dialogs.edit.fields.code", "Code")}
							value={editFormData.code}
							onChange={(value) => setEditFormData((prev) => ({ ...prev, code: value }))}
							required
						/>
						<TextField
							id="edit-title"
							label={t("settings.jobPositions.dialogs.edit.fields.title", "Title")}
							value={editFormData.title}
							onChange={(value) => setEditFormData((prev) => ({ ...prev, title: value }))}
							required
						/>
						<SelectField
							id="edit-level"
							label={t("settings.jobPositions.dialogs.edit.fields.level", "Level")}
							value={editFormData.level}
							onChange={(value) => setEditFormData((prev) => ({ ...prev, level: value as JobPositionLevel }))}
							options={LEVEL_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
							required
						/>
						<div className="grid gap-2 sm:grid-cols-2">
							<CheckboxField
								id="edit-is-leadership"
								label={t("settings.jobPositions.dialogs.edit.fields.leadership", "Leadership Role")}
								checked={editFormData.is_leadership}
								onChange={(checked) => setEditFormData((prev) => ({ ...prev, is_leadership: !!checked }))}
								hideFieldLabel={true}
							/>
							<CheckboxField
								id="edit-is-active"
								label={t("settings.jobPositions.dialogs.edit.fields.active", "Active")}
								checked={editFormData.is_active}
								onChange={(checked) => setEditFormData((prev) => ({ ...prev, is_active: !!checked }))}
								hideFieldLabel={true}
							/>
						</div>
						<TextAreaField
							id="edit-description"
							label={t("settings.jobPositions.dialogs.edit.fields.description", "Description")}
							value={editFormData.description}
							onChange={(value) => setEditFormData((prev) => ({ ...prev, description: value }))}
							rows={3}
						/>
					</div>
				)}
			</SettingsDialog>

			<SettingsDialog
				open={isDeleteDialogOpen}
				onOpenChange={handleCloseDeleteDialog}
				type="delete"
				title={t("settings.jobPositions.dialogs.delete.title", "Delete Job Position")}
				description={deletingItem ? t("settings.jobPositions.dialogs.delete.description", "Are you sure you want to delete \"{title}\"? This action cannot be undone.").replace("{title}", deletingItem.title) : undefined}
				onConfirm={handleDeleteConfirm}
				isSubmitting={isSubmitting}
				error={formError}
				submitDisabled={!deletingItem}
				entityName={t("settings.jobPositions.dialogs.delete.entityName", "job position")}
				entityData={deletingItem as any}
				renderEntityPreview={(position: JobPosition) => (
					<div className="space-y-1">
						<div className="font-semibold">{position.title}</div>
						<div className="text-sm text-muted-foreground">
							{position.code} • {formatLevelLabel(position.level)}
						</div>
						{position.description && (
							<p className="text-xs text-muted-foreground line-clamp-2">{position.description}</p>
						)}
					</div>
				)}
			/>
		</SettingsLayout>
	);
}

export default JobPositions;
