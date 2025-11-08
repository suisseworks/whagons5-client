import { useMemo, useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTags, faPlus, faChartBar } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import type { Tag, Category } from "@/store/types";
import { genericActions } from "@/store/genericSlices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { iconService } from "@/database/iconService";
import { UrlTabs } from "@/components/ui/url-tabs";
import {
	SettingsLayout,
	SettingsGrid,
	SettingsDialog,
	useSettingsState,
	createActionsCellRenderer,
	ColorIndicatorCellRenderer,
	TextField,
	SelectField
} from "../components";

// Name cell with dynamic icon and color
const TagNameCellRenderer = (props: ICellRendererParams) => {
	const [icon, setIcon] = useState<any>(faTags);
	const tagIcon = props.data?.icon as string | undefined;
	const tagColor = (props.data?.color as string | undefined) || "#6b7280";
	const tagName = props.value as string;

	useEffect(() => {
		const loadIcon = async () => {
			if (!tagIcon) {
				setIcon(faTags);
				return;
			}
			try {
				const iconClasses = tagIcon.split(" ");
				const iconName = iconClasses[iconClasses.length - 1];
				const loadedIcon = await iconService.getIcon(iconName);
				setIcon(loadedIcon || faTags);
			} catch {
				setIcon(faTags);
			}
		};
		loadIcon();
	}, [tagIcon]);

	return (
		<div className="flex items-center space-x-3 h-full">
			<FontAwesomeIcon icon={icon} className="w-4 h-4" style={{ color: tagColor }} />
			<span>{tagName}</span>
		</div>
	);
};

function Tags() {
    const dispatch = useDispatch();
	const { value: categories } = useSelector((state: RootState) => state.categories);
    // Hydrate local cache and ensure server sync similar to other settings pages
    useEffect(() => {
        // Tags data
        dispatch((genericActions as any).tags.getFromIndexedDB());
        dispatch((genericActions as any).tags.fetchFromAPI());
        // Categories for lookup
        dispatch((genericActions as any).categories.getFromIndexedDB());
    }, [dispatch]);

	const {
		items: tags,
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
	} = useSettingsState<Tag>({
		entityName: "tags",
		searchFields: ["name"] as any
	});

	// Form state
	const [createFormData, setCreateFormData] = useState<{
		name: string;
		color: string;
		icon: string;
		category_id: string;
	}>({
		name: "",
		color: "#6b7280",
		icon: "fas fa-tags",
		category_id: ""
	});

	const [editFormData, setEditFormData] = useState<{
		name: string;
		color: string;
		icon: string;
		category_id: string;
	}>({
		name: "",
		color: "#6b7280",
		icon: "fas fa-tags",
		category_id: ""
	});

	useEffect(() => {
		if (editingItem) {
			setEditFormData({
				name: editingItem.name || "",
				color: (editingItem as any).color || "#6b7280",
				icon: (editingItem as any).icon || "fas fa-tags",
				category_id: ((editingItem as any).category_id ?? "").toString()
			});
		}
	}, [editingItem]);

	const columns = useMemo<ColDef[]>(() => [
		{
			field: "name",
			headerName: "Tag",
			flex: 2,
			minWidth: 200,
			cellRenderer: TagNameCellRenderer
		},
		{
			colId: "category_name",
			headerName: "Category",
			flex: 2,
			minWidth: 200,
			valueGetter: (params: any) => {
				const catId = params.data?.category_id as number | null | undefined;
				if (!catId) return "Unassigned";
				const cat = (categories as any[])?.find((c: any) => c.id === Number(catId));
				return cat?.name || "Unassigned";
			},
			cellRenderer: (params: ICellRendererParams) => {
				const catId = params.data?.category_id as number | null | undefined;
				if (!catId) return <span className="text-muted-foreground">Unassigned</span> as any;
				const cat = (categories as any[])?.find((c: any) => c.id === Number(catId));
				if (!cat) return <span className="text-muted-foreground">Unassigned</span> as any;
				return (
					<ColorIndicatorCellRenderer value={cat.name} name={cat.name} color={(cat as any).color || "#6b7280"} />
				) as any;
			},
			sortable: true,
			filter: true
		},
		{
			field: "actions",
			headerName: "Actions",
			width: 100,
			suppressSizeToFit: true,
			cellRenderer: createActionsCellRenderer({ onEdit: handleEdit, onDelete: handleDelete }),
			sortable: false,
			filter: false,
			resizable: false,
			pinned: "right"
		}
	], [categories, handleEdit, handleDelete]);

	const handleCreateSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const data = {
			name: createFormData.name,
			color: createFormData.color,
			icon: createFormData.icon,
			category_id: createFormData.category_id ? parseInt(createFormData.category_id) : null
		} as Omit<Tag, "id" | "created_at" | "updated_at"> & { icon?: string | null; category_id?: number | null };
		await createItem(data as any);
		setCreateFormData({ name: "", color: "#6b7280", icon: "fas fa-tags", category_id: "" });
	};

	const handleEditSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingItem) return;
		const updates = {
			name: editFormData.name,
			color: editFormData.color,
			icon: editFormData.icon,
			category_id: editFormData.category_id ? parseInt(editFormData.category_id) : (editingItem as any).category_id ?? null
		} as Partial<Tag> & { icon?: string | null; category_id?: number | null };
		await updateItem(editingItem.id, updates);
	};

	return (
		<SettingsLayout
			title="Tags"
			description="Manage task tags for quick filtering and grouping"
			icon={faTags}
			iconColor="#a855f7"
			backPath="/settings"
			loading={{ isLoading: loading, message: "Loading tags..." }}
			error={error ? { message: error, onRetry: () => window.location.reload() } : undefined}
			headerActions={
				<Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
					<FontAwesomeIcon icon={faPlus} className="mr-2" />
					Add Tag
				</Button>
			}
		>
			<UrlTabs
				tabs={[
					{
						value: "tags",
						label: (
							<div className="flex items-center gap-2">
								<FontAwesomeIcon icon={faTags} className="w-4 h-4" />
								<span>Tags</span>
							</div>
						),
						content: (
							<div className="flex h-full flex-col">
								<div className="flex-1 min-h-0">
									<SettingsGrid
										rowData={filteredItems}
										columnDefs={columns}
										onRowClicked={handleEdit}
										noRowsMessage="No tags found"
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
								<Card>
									<CardHeader className="py-1">
										<CardTitle className="text-sm">Tag Statistics</CardTitle>
									</CardHeader>
									<CardContent className="py-2">
										<div className="grid grid-cols-1 gap-2 md:grid-cols-1">
											<div className="text-center">
												<div className="text-base font-semibold leading-none">{tags.length}</div>
												<div className="text-[11px] text-muted-foreground mt-1">Total Tags</div>
											</div>
										</div>
									</CardContent>
								</Card>
							</div>
						)
					}
				]}
				defaultValue="tags"
				basePath="/settings/tags"
				className="h-full flex flex-col"
			/>

			{/* Search */}
			<div className="mb-4">
				<input
					type="text"
					placeholder="Search tags..."
					value={searchQuery}
					onChange={(e) => { setSearchQuery(e.target.value); handleSearch(e.target.value); }}
					className="w-full max-w-md px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
				/>
			</div>

			{/* Create Dialog */}
			<SettingsDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				type="create"
				title="Add New Tag"
				description="Create a new tag for tasks."
				onSubmit={handleCreateSubmit}
				isSubmitting={isSubmitting}
				error={formError}
				submitDisabled={isSubmitting}
			>
				<div className="grid gap-4">
					<TextField id="name" label="Name" value={createFormData.name} onChange={(v) => setCreateFormData(p => ({ ...p, name: v }))} required />
					<TextField id="color" label="Color" type="color" value={createFormData.color} onChange={(v) => setCreateFormData(p => ({ ...p, color: v }))} />
					<TextField id="icon" label="Icon (FontAwesome class)" value={createFormData.icon} onChange={(v) => setCreateFormData(p => ({ ...p, icon: v }))} />
					<SelectField
						id="category"
						label="Category"
						value={createFormData.category_id}
						onChange={(v) => setCreateFormData(p => ({ ...p, category_id: v }))}
						placeholder="Unassigned"
						options={(categories as any[])?.map((c: any) => ({ value: c.id.toString(), label: c.name }))}
					/>
				</div>
			</SettingsDialog>

			{/* Edit Dialog */}
			<SettingsDialog
				open={isEditDialogOpen}
				onOpenChange={setIsEditDialogOpen}
				type="edit"
				title="Edit Tag"
				description="Update the tag information."
				onSubmit={handleEditSubmit}
				isSubmitting={isSubmitting}
				error={formError}
				submitDisabled={isSubmitting || !editingItem}
			>
				{editingItem && (
					<div className="grid gap-4">
						<TextField id="edit-name" label="Name" value={editFormData.name} onChange={(v) => setEditFormData(p => ({ ...p, name: v }))} required />
						<TextField id="edit-color" label="Color" type="color" value={editFormData.color} onChange={(v) => setEditFormData(p => ({ ...p, color: v }))} />
						<TextField id="edit-icon" label="Icon (FontAwesome class)" value={editFormData.icon} onChange={(v) => setEditFormData(p => ({ ...p, icon: v }))} />
						<SelectField
							id="edit-category"
							label="Category"
							value={editFormData.category_id}
							onChange={(v) => setEditFormData(p => ({ ...p, category_id: v }))}
							placeholder="Unassigned"
							options={(categories as any[])?.map((c: any) => ({ value: c.id.toString(), label: c.name }))}
						/>
					</div>
				)}
			</SettingsDialog>

			{/* Delete Dialog */}
			<SettingsDialog
				open={isDeleteDialogOpen}
				onOpenChange={handleCloseDeleteDialog}
				type="delete"
				title="Delete Tag"
				description={deletingItem ? `Are you sure you want to delete the tag "${deletingItem.name}"? This action cannot be undone.` : undefined}
				onConfirm={() => deletingItem ? deleteItem(deletingItem.id) : undefined}
				isSubmitting={isSubmitting}
				error={formError}
				submitDisabled={!deletingItem}
				entityName="tag"
				entityData={deletingItem as any}
				renderEntityPreview={(t: Tag) => (
					<div className="flex items-center space-x-3">
						<div className="w-4 h-4 rounded-full border" style={{ backgroundColor: (t as any).color || "#6b7280" }} />
						<div>
							<div className="font-medium">{t.name}</div>
						</div>
					</div>
				)}
			/>
		</SettingsLayout>
	);
}

export default Tags;


