/**
 * Type definitions for WorkspaceTable
 */

export type WorkspaceTableHandle = {
  clearFilters: () => void;
  hasFilters: () => boolean;
  setFilterModel: (model: any) => void;
  getFilterModel: () => any;
  clearSelection: () => void;
};
