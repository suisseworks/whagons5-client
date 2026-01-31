/**
 * Type definitions for workspace table column builders
 */

export interface ColumnBuilderOptions {
  getUserDisplayName: (user: any) => string;
  getStatusIcon: (iconName?: string) => any;
  getAllowedNextStatuses: (task: any) => number[];
  handleChangeStatus: (task: any, toStatusId: number) => Promise<boolean>;
  statusesLoaded: boolean;
  priorityMap: Record<number, any>;
  prioritiesLoaded: boolean;
  filteredPriorities: any[];
  statusMap: Record<number, any>;
  usersLoaded: boolean;
  getUsersFromIds: (ids: any[], userMap: Record<number, any>) => any[];
  spotMap: Record<number, any>;
  spotsLoaded: boolean;
  userMap: Record<number, any>;
  groupField?: string;
  showDescriptions: boolean;
  density?: 'compact' | 'comfortable' | 'spacious';
  tagMap: Record<number, any>;
  templateMap: Record<number, any>;
  formMap: Record<number, any>;
  taskTagsMap: Map<number, number[]>;
  taskUsers: any[];
  tagDisplayMode?: 'icon' | 'icon-text';
  visibleColumns?: string[];
  workspaceCustomFields: any[];
  taskCustomFieldValueMap: Map<string, any>;
  customFields: any[];
  categoryMap: Record<number, any>;
  taskNotes: any[];
  taskAttachments: any[];
  approvalApprovers: any[];
  currentUserId?: number;
  approvalMap: Record<number, any>;
  taskApprovalInstances: any[];
  onDeleteTask?: (id: number) => void;
  onLogTask?: (id: number) => void;
  slaMap: Record<number, any>;
  roleMap: Record<number, any>;
  getDoneStatusId: () => number | undefined;
  formatDueDate: (date: string | null) => string;
  t?: (key: string, fallback?: string) => string;
}
