import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTags,
  faPlus,
  faCubes,
  faChartBar
} from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { genericActions } from '@/store/genericSlices';
import { Category, Task, Team, StatusTransitionGroup, Sla, Approval } from "@/store/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { iconService } from '@/database/iconService';
import { UrlTabs } from "@/components/ui/url-tabs";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  IconPicker,
  CategoryFieldsManager,
  TextField,
  SelectField,
  CheckboxField
} from "../components";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";

// Form data interface for edit form
interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  enabled: boolean;
  team_id: string;
  sla_id: string;
  approval_id: string;
  status_transition_group_id: string;
}

// Custom cell renderer for category name with icon
const CategoryNameCellRenderer = (props: ICellRendererParams) => {
  const [icon, setIcon] = useState<any>(faTags);
  const categoryIcon = props.data?.icon;
  const categoryColor = props.data?.color || '#6B7280';
  const categoryName = props.value;

  useEffect(() => {
    const loadIcon = async () => {
      if (!categoryIcon) {
        setIcon(faTags);
        return;
      }

      try {
        // Parse FontAwesome icon class (e.g., "fas fa-hat-wizard")
        const iconClasses = categoryIcon.split(' ');
        const iconName = iconClasses[iconClasses.length - 1]; // Get the last part (hat-wizard)

        // Use iconService to load the icon dynamically
        const loadedIcon = await iconService.getIcon(iconName);
        setIcon(loadedIcon || faTags);
      } catch (error) {
        console.error('Error loading category icon:', error);
        setIcon(faTags);
      }
    };

    loadIcon();
  }, [categoryIcon]);

  return (
    <div className="flex items-center space-x-3 h-full">
      <FontAwesomeIcon
        icon={icon}
        className="w-4 h-4"
        style={{ color: categoryColor }}
      />
      <div className="flex flex-col leading-tight">
        <span className={!props.data?.enabled ? "line-through text-muted-foreground" : undefined}>{categoryName}</span>
        {props.data?.description ? (
          <span className={`text-xs truncate ${!props.data?.enabled ? "line-through text-muted-foreground" : "text-muted-foreground"}`}>{props.data.description}</span>
        ) : null}
      </div>
    </div>
  );
};

// Custom cell renderer for enabled status
const EnabledCellRenderer = (props: ICellRendererParams) => {
  const isEnabled = props.value;
  
  return (
    <Badge 
      variant={isEnabled ? "default" : "secondary"} 
      className={isEnabled ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-gray-100 text-gray-800 hover:bg-gray-100"}
    >
      {isEnabled ? "Enabled" : "Disabled"}
    </Badge>
  );
};

function Categories() {
  const dispatch = useDispatch();
  const { value: teams } = useSelector((state: RootState) => state.teams) as { value: Team[] };
  const { value: tasks } = useSelector((state: RootState) => state.tasks) as { value: Task[] };
  const { value: categoryCustomFields } = useSelector((state: RootState) => state.categoryCustomFields) as { value: any[] };
  const statusTransitionGroups = useSelector((s: RootState) => (s as any).statusTransitionGroups.value) as StatusTransitionGroup[];
  const slasState = useSelector((state: RootState) => (state as any).slas) as { value?: Sla[] } | undefined;
  const slas: Sla[] = slasState?.value ?? [];
  const approvalsState = useSelector((state: RootState) => (state as any).approvals) as { value?: Approval[] } | undefined;
  const approvals: Approval[] = approvalsState?.value ?? [];

  // Ensure local IndexedDB hydration on mount (no network requests)
  useEffect(() => {
    dispatch((genericActions as any).categories.getFromIndexedDB());
    dispatch((genericActions as any).categories.fetchFromAPI());
    dispatch((genericActions as any).teams.getFromIndexedDB());
    dispatch((genericActions as any).slas.getFromIndexedDB());
    dispatch((genericActions as any).approvals.getFromIndexedDB());
    dispatch((genericActions as any).approvals.fetchFromAPI());
    dispatch((genericActions as any).statusTransitionGroups.getFromIndexedDB());
    dispatch((genericActions as any).categoryCustomFields.getFromIndexedDB());
  }, [dispatch]);

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
    sla_id: '',
    approval_id: '',
    status_transition_group_id: ''
  });

  // Form state for edit dialog
  const [editFormData, setEditFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    color: '#4ECDC4',
    icon: 'fas fa-tags',
    enabled: true,
    team_id: '',
    sla_id: '',
    approval_id: '',
    status_transition_group_id: ''
  });

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
        sla_id: editingCategory.sla_id?.toString() || '',
        approval_id: (editingCategory as any).approval_id?.toString?.() || '',
        status_transition_group_id: editingCategory.status_transition_group_id?.toString() || ''
      });
    }
  }, [editingCategory]);

  // Manage Fields dialog state
  const [isFieldsDialogOpen, setIsFieldsDialogOpen] = useState(false);
  const [fieldsCategory, setFieldsCategory] = useState<Category | null>(null);

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

  // Derived statistics for charts
  const enabledCategoriesCount = useMemo(
    () => categories.filter((cat: Category) => cat.enabled).length,
    [categories]
  );

  const disabledCategoriesCount = useMemo(
    () => categories.filter((cat: Category) => !cat.enabled).length,
    [categories]
  );

  const tasksByCategory = useMemo(() => {
    const counts = new Map<number, number>();
    (tasks as Task[]).forEach((task: Task) => {
      const cid = task.category_id;
      if (!cid) return;
      counts.set(cid, (counts.get(cid) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([categoryId, count]) => {
        const category = categories.find((c: Category) => c.id === categoryId);
        return category ? { category, count } : null;
      })
      .filter(
        (item): item is { category: Category; count: number } => !!item
      )
      .sort((a, b) => b.count - a.count);
  }, [tasks, categories]);

  const categoriesByTeam = useMemo(() => {
    const counts = new Map<number, number>();
    categories.forEach((cat: Category) => {
      const tid = (cat as any).team_id as number | null | undefined;
      if (!tid) return;
      counts.set(tid, (counts.get(tid) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([teamId, count]) => {
        const team = teams.find((t: Team) => t.id === teamId);
        return team ? { team, count } : null;
      })
      .filter(
        (item): item is { team: Team; count: number } => !!item
      )
      .sort((a, b) => b.count - a.count);
  }, [categories, teams]);

  const tasksOverTime = useMemo(() => {
    const map = new Map<string, number>();
    (tasks as Task[]).forEach((task: Task) => {
      if (!task.created_at) return;
      const date = dayjs(task.created_at).format("YYYY-MM-DD");
      map.set(date, (map.get(date) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [tasks]);

  // Column definitions for AG Grid
  const colDefs = useMemo<ColDef[]>(() => [
    { 
      field: 'name', 
      headerName: 'Category Name',
      flex: 4,
      minWidth: 350,
      cellRenderer: CategoryNameCellRenderer
    },
    // Description column removed; description now shown under name
    // Fields column removed per request
    {
      field: 'team_id',
      headerName: 'Team',
      flex: 1.5,
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams) => {
        const teamId = params.value;

        if (!teamId) {
          return <span className="text-muted-foreground">No Team</span>;
        }

        const team = teams.find((t: any) => t.id === teamId);

        return (
          <div className="flex items-center space-x-2">
            <div 
              className="w-6 h-6 min-w-[1.5rem] text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
              style={{ backgroundColor: team?.color ?? '#6B7280' }}
            >
              {team?.name ? team.name.charAt(0).toUpperCase() : 'T'}
            </div>
            <span>{team?.name || `Team ${teamId}`}</span>
          </div>
        );
      },
      sortable: true,
      filter: true
    },
    {
      field: 'sla_id',
      headerName: 'SLA',
      flex: 1.2,
      minWidth: 180,
      cellRenderer: (params: ICellRendererParams) => {
        const slaId = params.value as number | null | undefined;
        if (!slaId) {
          return '' as any;
        }
        const sla = slas.find((s: Sla) => s.id === Number(slaId));
        return <span>{sla?.name || `SLA ${slaId}`}</span>;
      },
      sortable: true,
      filter: true
    },
    {
      field: 'approval_id',
      headerName: 'Approval',
      flex: 1.2,
      minWidth: 180,
      cellRenderer: (params: ICellRendererParams) => {
        const approvalId = params.value as number | null | undefined;
        if (!approvalId) {
          return '' as any;
        }
        const approval = approvals.find((a: Approval) => a.id === Number(approvalId));
        return <span>{approval?.name || `Approval ${approvalId}`}</span>;
      },
      sortable: true,
      filter: true
    },
    {
      field: 'status_transition_group_id',
      headerName: 'Status Transition Group',
      flex: 1.5,
      minWidth: 240,
      cellRenderer: (params: ICellRendererParams) => {
        const groupId = params.value as number | null | undefined;
        if (!groupId) {
          return <span className="text-muted-foreground">Unassigned</span>;
        }
        const group = statusTransitionGroups.find((g: any) => g.id === Number(groupId));
        return <span>{group?.name || `Group ${groupId}`}</span>;
      },
      sortable: true,
      filter: true
    },
    {
      field: 'enabled',
      headerName: 'Status',
      flex: 0.8,
      minWidth: 120,
      cellRenderer: EnabledCellRenderer,
      sortable: true,
      filter: true
    },
    {
      headerName: 'Actions',
      colId: 'actions',
      minWidth: 200,
      suppressSizeToFit: true,
      cellRenderer: createActionsCellRenderer({
        customActions: [{
          icon: faCubes,
          label: (row: any) => {
            const count = assignmentCountByCategory[Number(row?.id)] || 0;
            return count > 0 ? `Fields (${count})` : 'Fields';
          },
          variant: 'outline',
          onClick: openManageFields,
          className: 'p-1 h-7 relative flex items-center justify-center'
        }],
        onEdit: handleEdit,
        onDelete: handleDeleteCategory
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [teams, slas, approvals, statusTransitionGroups, handleEdit, handleDeleteCategory, assignmentCountByCategory, openManageFields]);

  // Form handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createFormData.team_id) {
      throw new Error('Please select a team for this category.');
    }
    if (!createFormData.status_transition_group_id) {
      throw new Error('Please select a transition group for this category.');
    }

    const categoryData = {
      name: createFormData.name,
      description: createFormData.description,
      color: createFormData.color,
      icon: createFormData.icon,
      enabled: createFormData.enabled,
      team_id: parseInt(createFormData.team_id),
      workspace_id: 1,
      sla_id: createFormData.sla_id ? parseInt(createFormData.sla_id) : null,
      approval_id: createFormData.approval_id ? parseInt(createFormData.approval_id) : null,
      status_transition_group_id: parseInt(createFormData.status_transition_group_id),
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
      sla_id: '',
      approval_id: '',
      status_transition_group_id: ''
    });
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
      workspace_id: 1,
      sla_id: editFormData.sla_id ? parseInt(editFormData.sla_id) : null,
      approval_id: editFormData.approval_id ? parseInt(editFormData.approval_id) : null,
      status_transition_group_id: editFormData.status_transition_group_id ? parseInt(editFormData.status_transition_group_id) : undefined
    };
    await updateItem(editingCategory.id, updates);
  };

  // Render entity preview for delete dialog
  const renderCategoryPreview = (category: Category) => {
    const [icon, setIcon] = useState<any>(faTags);

    useEffect(() => {
      const loadIcon = async () => {
        if (!category.icon) {
          setIcon(faTags);
          return;
        }

        try {
          // Parse FontAwesome icon class (e.g., "fas fa-hat-wizard")
          const iconClasses = category.icon.split(' ');
          const iconName = iconClasses[iconClasses.length - 1]; // Get the last part (hat-wizard)

          // Use iconService to load the icon dynamically
          const loadedIcon = await iconService.getIcon(iconName);
          setIcon(loadedIcon || faTags);
        } catch (error) {
          console.error('Error loading category preview icon:', error);
          setIcon(faTags);
        }
      };

      loadIcon();
    }, [category.icon]);

    return (
      <div className="flex items-center space-x-3">
        <FontAwesomeIcon
          icon={icon}
          className="w-5 h-5"
          style={{ color: category.color }}
        />
        <div>
          <div className="font-medium">{category.name}</div>
          <div className="text-sm text-muted-foreground">{category.description}</div>
          <div className="flex items-center space-x-2 mt-1">
            {category.team_id && (() => {
              const team = teams.find((t: Team) => t.id === category.team_id);
              return (
                <div className="flex items-center space-x-1">
                  <div 
                    className="w-4 h-4 min-w-[1rem] text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                    style={{ backgroundColor: team?.color ?? '#6B7280' }}
                  >
                    {team?.name?.charAt(0).toUpperCase() || 'T'}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {team?.name || `Team ${category.team_id}`}
                  </span>
                </div>
              );
            })()}
            <Badge
              variant={category.enabled ? "default" : "secondary"}
              className={`text-xs ${category.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
            >
              {category.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {getCategoryTaskCount(category.id)} task{getCategoryTaskCount(category.id) !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <SettingsLayout
      title="Categories"
      description="Manage task categories and labels for better organization"
      icon={faTags}
      iconColor="#ef4444"
      loading={{
        isLoading: loading,
        message: "Loading categories..."
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      headerActions={
        <div className="flex items-center space-x-2">
          <Link to="/settings/categories/custom-fields">
            <Button variant="outline" className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring">
              Manage custom fields
            </Button>
          </Link>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
            <span>Add Category</span>
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
                <span>Categories</span>
              </div>
            ),
            content: (
              <div className="flex h-full flex-col">
                <div className="flex-1 min-h-0">
                  <SettingsGrid
                    rowData={filteredItems}
                    columnDefs={colDefs}
                    noRowsMessage="No categories found"
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
                <span>Statistics</span>
              </div>
            ),
            content: (
              <div className="flex-1 min-h-0 overflow-auto p-4">
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{categories.length}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Total Categories
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {enabledCategoriesCount}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Enabled Categories
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {disabledCategoriesCount}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Disabled Categories
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Charts row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          Tasks by Category
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Distribution of tasks across categories
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {tasksByCategory.length > 0 ? (
                          <ReactECharts
                            option={{
                              tooltip: {
                                trigger: "item",
                                formatter: "{b}: {c} ({d}%)"
                              },
                              legend: {
                                orient: "vertical",
                                left: "left",
                                textStyle: { fontSize: 11 }
                              },
                              series: [
                                {
                                  name: "Tasks",
                                  type: "pie",
                                  radius: ["40%", "70%"],
                                  avoidLabelOverlap: false,
                                  itemStyle: {
                                    borderRadius: 8,
                                    borderColor: "#fff",
                                    borderWidth: 2
                                  },
                                  label: {
                                    show: true,
                                    formatter: "{b}: {c}"
                                  },
                                  emphasis: {
                                    label: {
                                      show: true,
                                      fontSize: 14,
                                      fontWeight: "bold"
                                    }
                                  },
                                  data: tasksByCategory.map((item) => ({
                                    value: item.count,
                                    name: item.category.name,
                                    itemStyle: {
                                      color: item.category.color || "#6b7280"
                                    }
                                  }))
                                }
                              ]
                            }}
                            style={{ height: "300px" }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                            No task data available
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          Categories by Team
                        </CardTitle>
                        <CardDescription className="text-xs">
                          How categories are distributed across teams
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {categoriesByTeam.length > 0 ? (
                          <ReactECharts
                            option={{
                              tooltip: {
                                trigger: "axis",
                                axisPointer: { type: "shadow" }
                              },
                              grid: {
                                left: "3%",
                                right: "4%",
                                bottom: "3%",
                                containLabel: true
                              },
                              xAxis: {
                                type: "value",
                                name: "Categories"
                              },
                              yAxis: {
                                type: "category",
                                data: categoriesByTeam
                                  .map((item) => item.team.name)
                                  .reverse(),
                                axisLabel: {
                                  formatter: (value: string) =>
                                    value.length > 20
                                      ? value.substring(0, 20) + "..."
                                      : value
                                }
                              },
                              series: [
                                {
                                  name: "Categories",
                                  type: "bar",
                                  data: categoriesByTeam
                                    .map((item) => ({
                                      value: item.count,
                                      itemStyle: {
                                        color:
                                          item.team.color || "#3b82f6"
                                      }
                                    }))
                                    .reverse()
                                }
                              ]
                            }}
                            style={{ height: "300px" }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                            No team data available
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tasks over time */}
                  {tasksOverTime.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          Tasks Created Over Time
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Last 30 days of task creation across categories
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ReactECharts
                          option={{
                            tooltip: {
                              trigger: "axis",
                              formatter: (params: any) => {
                                const param = params[0];
                                return `${param.axisValue}<br/>${param.marker}${param.seriesName}: ${param.value}`;
                              }
                            },
                            grid: {
                              left: "3%",
                              right: "4%",
                              bottom: "3%",
                              containLabel: true
                            },
                            xAxis: {
                              type: "category",
                              data: tasksOverTime.map((item) =>
                                dayjs(item.date).format("MMM DD")
                              ),
                              axisLabel: {
                                rotate: 45,
                                fontSize: 10
                              }
                            },
                            yAxis: {
                              type: "value",
                              name: "Tasks"
                            },
                            series: [
                              {
                                name: "Tasks Created",
                                type: "line",
                                smooth: true,
                                data: tasksOverTime.map(
                                  (item) => item.count
                                ),
                                areaStyle: {
                                  color: {
                                    type: "linear",
                                    x: 0,
                                    y: 0,
                                    x2: 0,
                                    y2: 1,
                                    colorStops: [
                                      {
                                        offset: 0,
                                        color:
                                          "rgba(59, 130, 246, 0.3)"
                                      },
                                      {
                                        offset: 1,
                                        color:
                                          "rgba(59, 130, 246, 0.05)"
                                      }
                                    ]
                                  }
                                },
                                itemStyle: {
                                  color: "#3b82f6"
                                },
                                lineStyle: {
                                  color: "#3b82f6",
                                  width: 2
                                }
                              }
                            ]
                          }}
                          style={{ height: "300px" }}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )
          }
        ]}
        defaultValue="categories"
        basePath="/settings/categories"
        className="h-full flex flex-col"
      />

      {/* Search Input - Original Location */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            handleSearch(e.target.value);
          }}
          className="w-full max-w-md px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>

      {/* Create Category Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title="Add New Category"
        description="Add a new category to organize your tasks."
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="grid gap-4">
          <TextField
            id="name"
            label="Name"
            value={createFormData.name}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, name: value }))}
            required
          />
          <TextField
            id="description"
            label="Description"
            value={createFormData.description}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, description: value }))}
          />
          <TextField
            id="color"
            label="Color"
            type="color"
            value={createFormData.color}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, color: value }))}
          />
          <IconPicker
            id="icon"
            label="Icon"
            value={createFormData.icon}
            onChange={(iconClass) => setCreateFormData(prev => ({ ...prev, icon: iconClass }))}
            color={createFormData.color}
            required
          />
          <SelectField
            id="team"
            label="Team"
            value={createFormData.team_id}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, team_id: value }))}
            placeholder="No Team"
            options={teams.map((team: Team) => ({
              value: team.id.toString(),
              label: team.name
            }))}
            required
          />
          <SelectField
            id="sla"
            label="SLA"
            value={createFormData.sla_id}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, sla_id: value === 'none' ? '' : value }))}
            placeholder="Select SLA…"
            options={[{ value: 'none', label: 'None' }, ...(slas as Sla[]).map((s: Sla) => ({
              value: s.id.toString(),
              label: s.name
            }))]}
          />
          <SelectField
            id="approval"
            label="Approval"
            value={createFormData.approval_id}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, approval_id: value === 'none' ? '' : value }))}
            placeholder="Select approval…"
            options={[{ value: 'none', label: 'None' }, ...(approvals as Approval[]).map((a: Approval) => ({
              value: a.id.toString(),
              label: a.name
            }))]}
          />
          <SelectField
            id="status-group"
            label="Status Transition Group"
            value={createFormData.status_transition_group_id}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, status_transition_group_id: value }))}
            placeholder="Select group…"
            options={statusTransitionGroups.map((g: StatusTransitionGroup) => ({
              value: g.id.toString(),
              label: g.name
            }))}
            required
          />
          <CheckboxField
            id="enabled"
            label="Status"
            checked={createFormData.enabled}
            onChange={(checked) => setCreateFormData(prev => ({ ...prev, enabled: checked }))}
            description="Enabled"
          />
        </div>
      </SettingsDialog>

      {/* Edit Category Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        type="edit"
        title="Edit Category"
        description="Update the category information."
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingCategory}
      >
        <div className="grid gap-4">
          <TextField
            id="edit-name"
            label="Name"
            value={editFormData.name}
            onChange={(value) => setEditFormData(prev => ({ ...prev, name: value }))}
            required
          />
          <TextField
            id="edit-description"
            label="Description"
            value={editFormData.description}
            onChange={(value) => setEditFormData(prev => ({ ...prev, description: value }))}
          />
          <TextField
            id="edit-color"
            label="Color"
            type="color"
            value={editFormData.color}
            onChange={(value) => setEditFormData(prev => ({ ...prev, color: value }))}
          />
          <IconPicker
            id="edit-icon"
            label="Icon"
            value={editFormData.icon}
            onChange={(iconClass) => setEditFormData(prev => ({ ...prev, icon: iconClass }))}
            color={editFormData.color}
            required
          />
          <SelectField
            id="edit-team"
            label="Team"
            value={editFormData.team_id}
            onChange={(value) => setEditFormData(prev => ({ ...prev, team_id: value }))}
            placeholder="No Team"
            options={teams.map((team: Team) => ({
              value: team.id.toString(),
              label: team.name
            }))}
          />
          <SelectField
            id="edit-sla"
            label="SLA"
            value={editFormData.sla_id}
            onChange={(value) => setEditFormData(prev => ({ ...prev, sla_id: value === 'none' ? '' : value }))}
            placeholder="Select SLA…"
            options={[{ value: 'none', label: 'None' }, ...(slas as Sla[]).map((s: Sla) => ({
              value: s.id.toString(),
              label: s.name
            }))]}
          />
          <SelectField
            id="edit-approval"
            label="Approval"
            value={editFormData.approval_id}
            onChange={(value) => setEditFormData(prev => ({ ...prev, approval_id: value === 'none' ? '' : value }))}
            placeholder="Select approval…"
            options={[{ value: 'none', label: 'None' }, ...(approvals as Approval[]).map((a: Approval) => ({
              value: a.id.toString(),
              label: a.name
            }))]}
          />
          <SelectField
            id="edit-status-group"
            label="Status Transition Group"
            value={editFormData.status_transition_group_id}
            onChange={(value) => setEditFormData(prev => ({ ...prev, status_transition_group_id: value }))}
            placeholder="Select group…"
            options={statusTransitionGroups.map((g: StatusTransitionGroup) => ({
              value: g.id.toString(),
              label: g.name
            }))}
            required
          />
          <CheckboxField
            id="edit-enabled"
            label="Status"
            checked={editFormData.enabled}
            onChange={(checked) => setEditFormData(prev => ({ ...prev, enabled: checked }))}
            description="Enabled"
          />
        </div>
      </SettingsDialog>

      {/* Delete Category Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete Category"
        description={
          deletingCategory ? (() => {
            const taskCount = getCategoryTaskCount(deletingCategory.id);
            
            if (taskCount > 0) {
              return `This category cannot be deleted because it contains ${taskCount} task${taskCount !== 1 ? 's' : ''}. Please reassign or delete all tasks in this category first.`;
            } else {
              return `Are you sure you want to delete the category "${deletingCategory.name}"? This action cannot be undone.`;
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
    </SettingsLayout>
  );
}

export default Categories;
