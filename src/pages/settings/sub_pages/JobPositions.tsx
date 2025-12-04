import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBriefcase, faPlus, faChartBar } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
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
} from "../components";

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

	useEffect(() => {
		dispatch((genericActions as any).jobPositions.getFromIndexedDB());
		dispatch((genericActions as any).jobPositions.fetchFromAPI());
	}, [dispatch]);

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
			headerName: "Code",
			minWidth: 140,
			flex: 1
		},
		{
			field: "title",
			headerName: "Title",
			minWidth: 220,
			flex: 2
		},
		{
			field: "level",
			headerName: "Level",
			minWidth: 160,
			flex: 1,
			cellRenderer: (params: ICellRendererParams<JobPosition>) => <LevelBadge level={params.value} />
		},
		{
			field: "is_leadership",
			headerName: "Leadership",
			minWidth: 150,
			cellRenderer: (params: ICellRendererParams<JobPosition>) => (
				<BooleanBadgeCellRenderer
					value={!!params.value}
					trueText="Leadership"
					falseText="Individual"
					trueVariant="default"
					falseVariant="secondary"
				/>
			)
		},
		{
			field: "is_active",
			headerName: "Status",
			minWidth: 130,
			cellRenderer: (params: ICellRendererParams<JobPosition>) => (
				<BooleanBadgeCellRenderer
					value={!!params.value}
					trueText="Active"
					falseText="Inactive"
					trueVariant="default"
					falseVariant="secondary"
				/>
			)
		},
		{
			field: "description",
			headerName: "Description",
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
			headerName: "Actions",
			width: 110,
			pinned: "right",
			cellRenderer: createActionsCellRenderer({
				onEdit: handleEdit,
				onDelete: handleDelete
			}),
			sortable: false,
			filter: false,
			resizable: false
		}
	], [handleDelete, handleEdit]);

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
			title="Job Positions"
			description="Standardize role titles for reporting, permissions, and analytics."
			icon={faBriefcase}
			iconColor="#2563eb"
			backPath="/settings"
			loading={{ isLoading: loading, message: "Loading job positions..." }}
			error={error ? { message: error, onRetry: () => window.location.reload() } : undefined}
			headerActions={(
				<Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
					<FontAwesomeIcon icon={faPlus} className="mr-2" />
					Add Job Position
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
								<span>Positions</span>
							</div>
						),
						content: (
							<div className="flex h-full flex-col">
								<div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
									<input
										type="text"
										placeholder="Search by code or title..."
										value={searchQuery}
										onChange={(e) => {
											setSearchQuery(e.target.value);
											handleSearch(e.target.value);
										}}
										className="w-full md:w-80 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
									/>
									<p className="text-xs text-muted-foreground">
										Showing {filteredItems.length} of {items.length} positions
									</p>
								</div>
								<div className="flex-1 min-h-0">
									<SettingsGrid
										rowData={filteredItems}
										columnDefs={columns}
										onRowClicked={handleEdit}
										noRowsMessage="No job positions found"
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
								<span>Statistics</span>
							</div>
						),
						content: (
							<div className="flex-1 min-h-0 overflow-auto">
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
									<Card>
										<CardHeader className="py-2">
											<CardTitle className="text-sm">Overview</CardTitle>
											<CardDescription className="text-xs">Snapshot of your catalog</CardDescription>
										</CardHeader>
										<CardContent className="py-2">
											<div className="grid grid-cols-2 gap-3 text-center">
												<div>
													<div className="text-lg font-semibold">{stats.total}</div>
													<div className="text-[11px] text-muted-foreground">Total</div>
												</div>
												<div>
													<div className="text-lg font-semibold">{stats.active}</div>
													<div className="text-[11px] text-muted-foreground">Active</div>
												</div>
												<div>
													<div className="text-lg font-semibold">{stats.leadership}</div>
													<div className="text-[11px] text-muted-foreground">Leadership</div>
												</div>
												<div>
													<div className="text-lg font-semibold">{stats.individual}</div>
													<div className="text-[11px] text-muted-foreground">Individual</div>
												</div>
											</div>
										</CardContent>
									</Card>
									<Card className="md:col-span-1 lg:col-span-2">
										<CardHeader className="py-2">
											<CardTitle className="text-sm">Level Distribution</CardTitle>
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
														<span className="text-muted-foreground text-xs">Inactive roles</span>
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
				title="Add Job Position"
				description="Define a reusable job position for assignments and reporting."
				onSubmit={handleCreateSubmit}
				isSubmitting={isSubmitting}
				error={formError}
				submitDisabled={isSubmitting}
			>
				<div className="grid gap-4">
					<TextField
						id="create-code"
						label="Code"
						value={createFormData.code}
						onChange={(value) => setCreateFormData((prev) => ({ ...prev, code: value }))}
						placeholder="e.g., OPS-MGR"
						required
					/>
					<TextField
						id="create-title"
						label="Title"
						value={createFormData.title}
						onChange={(value) => setCreateFormData((prev) => ({ ...prev, title: value }))}
						placeholder="Operations Manager"
						required
					/>
					<SelectField
						id="create-level"
						label="Level"
						value={createFormData.level}
						onChange={(value) => setCreateFormData((prev) => ({ ...prev, level: value as JobPositionLevel }))}
						options={LEVEL_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
						required
					/>
					<div className="grid gap-2 sm:grid-cols-2">
						<CheckboxField
							id="create-is-leadership"
							label="Leadership Role"
							checked={createFormData.is_leadership}
							onChange={(checked) => setCreateFormData((prev) => ({ ...prev, is_leadership: !!checked }))}
							description="Marks the position as part of management."
						/>
						<CheckboxField
							id="create-is-active"
							label="Active"
							checked={createFormData.is_active}
							onChange={(checked) => setCreateFormData((prev) => ({ ...prev, is_active: !!checked }))}
							description="Inactive roles remain in history but can't be assigned."
						/>
					</div>
					<TextAreaField
						id="create-description"
						label="Description"
						value={createFormData.description}
						onChange={(value) => setCreateFormData((prev) => ({ ...prev, description: value }))}
						placeholder="Optional summary of responsibilities and scope."
						rows={3}
					/>
				</div>
			</SettingsDialog>

			<SettingsDialog
				open={isEditDialogOpen}
				onOpenChange={setIsEditDialogOpen}
				type="edit"
				title="Edit Job Position"
				description="Update the selected job position."
				onSubmit={handleEditSubmit}
				isSubmitting={isSubmitting}
				error={formError}
				submitDisabled={isSubmitting || !editingItem}
			>
				{editingItem && (
					<div className="grid gap-4">
						<TextField
							id="edit-code"
							label="Code"
							value={editFormData.code}
							onChange={(value) => setEditFormData((prev) => ({ ...prev, code: value }))}
							required
						/>
						<TextField
							id="edit-title"
							label="Title"
							value={editFormData.title}
							onChange={(value) => setEditFormData((prev) => ({ ...prev, title: value }))}
							required
						/>
						<SelectField
							id="edit-level"
							label="Level"
							value={editFormData.level}
							onChange={(value) => setEditFormData((prev) => ({ ...prev, level: value as JobPositionLevel }))}
							options={LEVEL_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
							required
						/>
						<div className="grid gap-2 sm:grid-cols-2">
							<CheckboxField
								id="edit-is-leadership"
								label="Leadership Role"
								checked={editFormData.is_leadership}
								onChange={(checked) => setEditFormData((prev) => ({ ...prev, is_leadership: !!checked }))}
							/>
							<CheckboxField
								id="edit-is-active"
								label="Active"
								checked={editFormData.is_active}
								onChange={(checked) => setEditFormData((prev) => ({ ...prev, is_active: !!checked }))}
							/>
						</div>
						<TextAreaField
							id="edit-description"
							label="Description"
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
				title="Delete Job Position"
				description={deletingItem ? `Are you sure you want to delete "${deletingItem.title}"? This action cannot be undone.` : undefined}
				onConfirm={handleDeleteConfirm}
				isSubmitting={isSubmitting}
				error={formError}
				submitDisabled={!deletingItem}
				entityName="job position"
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
