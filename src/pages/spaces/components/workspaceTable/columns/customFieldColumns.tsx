/**
 * Custom field columns builder - creates dynamic columns for workspace custom fields
 */

import { ColumnBuilderOptions } from './types';

function createCustomFieldColumn(
  fieldId: number,
  field: any,
  headerName: string,
  taskCustomFieldValueMap: Map<string, any>
) {
  const colKey = `cf_${fieldId}`;
  
  return {
    field: colKey,
    colId: colKey,
    headerName,
    sortable: false,
    filter: false,
    minWidth: 160,
    flex: 2,
    valueGetter: (p: any) => {
      const taskId = Number(p.data?.id);
      if (!Number.isFinite(taskId) || !taskCustomFieldValueMap) return null;
      const key = `${taskId}:${fieldId}`;
      const row = taskCustomFieldValueMap.get(key);
      if (!row) return null;
      const fieldType = String(row.type || row.field_type || field.type || '').toLowerCase();
      
      // Try typed value fields first based on field type
      if (fieldType === 'number' || fieldType === 'numeric') {
        if (row.value_numeric != null) return row.value_numeric;
        if (row.value != null) return Number(row.value);
      }
      if (fieldType === 'date' || fieldType === 'datetime') {
        if (row.value_date != null) return row.value_date;
        if (row.value != null) return row.value;
      }
      if (fieldType === 'json') {
        if (row.value_json != null) return row.value_json;
        if (row.value != null) return row.value;
      }
      
      // Fallback: try all value fields in order of preference
      if (row.value_numeric != null) return row.value_numeric;
      if (row.value_date != null) return row.value_date;
      if (row.value_json != null) return row.value_json;
      if (row.value_text != null) return row.value_text;
      if (row.value != null) return row.value;
      
      return null;
    },
    cellRenderer: (p: any) => {
      const v = p.value;
      if (v === null || v === undefined || v === '') {
        return (
          <div className="flex items-center h-full py-2">
            <span className="text-[12px] text-muted-foreground">—</span>
          </div>
        );
      }
      if (typeof v === 'number') {
        return (
          <div className="flex items-center h-full py-2">
            <span className="text-[12px] truncate max-w-full">{v.toLocaleString()}</span>
          </div>
        );
      }
      return (
        <div className="flex items-center h-full py-2">
          <span className="text-[12px] truncate max-w-full">{String(v)}</span>
        </div>
      );
    },
  };
}

export function createCustomFieldColumns(opts: ColumnBuilderOptions) {
  const {
    workspaceCustomFields,
    taskCustomFieldValueMap,
    customFields,
    visibleColumns,
  } = opts;

  const visibilitySet: Set<string> | null = Array.isArray(visibleColumns)
    ? new Set<string>(visibleColumns as string[])
    : null;

  const isVisible = (id: string | undefined): boolean => {
    if (!visibilitySet) return true;
    if (!id) return true;
    if (id === 'name' || id === 'notes' || id === 'id') return true;
    return visibilitySet.has(id);
  };

  const customFieldCols: any[] = [];
  const processedFieldIds = new Set<number>();
  
  // First, process fields from workspaceCustomFields (preferred source with category info)
  if (Array.isArray(workspaceCustomFields) && workspaceCustomFields.length > 0) {
    for (const cf of workspaceCustomFields as any[]) {
      const fieldId = Number((cf as any).fieldId);
      const field = (cf as any).field || {};
      const categoriesForField = (cf as any).categories || [];
      if (!Number.isFinite(fieldId)) continue;

      const colKey = `cf_${fieldId}`;
      if (!isVisible(colKey)) continue;

      processedFieldIds.add(fieldId);

      const headerName = (() => {
        const base = String(field.name || `Field #${fieldId}`);
        if (!categoriesForField || categoriesForField.length === 0) return base;
        const names = categoriesForField.map((c: any) => c?.name).filter(Boolean);
        if (names.length === 0) return base;
        if (names.length === 1) return `${base} (${names[0]})`;
        return `${base} (${names[0]} +${names.length - 1})`;
      })();

      customFieldCols.push(createCustomFieldColumn(fieldId, field, headerName, taskCustomFieldValueMap));
    }
  }
  
  // Also check taskCustomFieldValueMap for fields with values that might not be in workspaceCustomFields
  // This ensures columns persist even when workspaceCustomFields is temporarily empty
  // BUT only create columns for fields that are actually assigned to categories in the current workspace
  if (taskCustomFieldValueMap && taskCustomFieldValueMap.size > 0 && Array.isArray(customFields) && customFields.length > 0 && workspaceCustomFields) {
    // Build a set of field IDs that are actually assigned to workspace categories
    const allowedFieldIds = new Set<number>();
    for (const cf of workspaceCustomFields as any[]) {
      const fieldId = Number((cf as any).fieldId);
      if (Number.isFinite(fieldId)) {
        allowedFieldIds.add(fieldId);
      }
    }
    
    const fieldIdsWithValues = new Set<number>();
    // Extract all field IDs that have values
    for (const [key] of taskCustomFieldValueMap) {
      const parts = String(key).split(':');
      if (parts.length === 2) {
        const fieldId = Number(parts[1]);
        if (Number.isFinite(fieldId)) {
          fieldIdsWithValues.add(fieldId);
        }
      }
    }
    
    // Create columns for fields with values that are visible but not yet processed
    // AND that are actually assigned to workspace categories
    for (const fieldId of fieldIdsWithValues) {
      if (processedFieldIds.has(fieldId)) continue;
      if (!allowedFieldIds.has(fieldId)) continue;
      
      const colKey = `cf_${fieldId}`;
      if (!isVisible(colKey)) continue;
      
      // Find field metadata
      const field = (customFields as any[]).find((f: any) => Number(f.id) === fieldId);
      if (!field) continue;
      
      // Use field name only (category info not available in fallback case)
      const headerName = String(field.name || `Field #${fieldId}`);
      
      customFieldCols.push(createCustomFieldColumn(fieldId, field, headerName, taskCustomFieldValueMap));
    }
  }

  return customFieldCols;
}
