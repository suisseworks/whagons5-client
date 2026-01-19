import { api } from '@/store/api/internalApi';
import { getFileUrl } from './assetApi';

export interface WorkspaceResource {
  id: number;
  uuid: string;
  workspace_id: number;
  file_path: string; // File ID from upload API
  file_url?: string | null; // Public URL from upload API (if available)
  file_name: string;
  file_extension: string;
  file_size: number;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceResourceResponse {
  data: WorkspaceResource | WorkspaceResource[];
  message: string;
  status: number;
}

/**
 * Get all resources for a workspace
 */
export const getWorkspaceResources = async (workspaceId: string): Promise<WorkspaceResource[]> => {
  const response = await api.get<WorkspaceResourceResponse>(
    `/workspaces/${workspaceId}/resources`
  );
  return Array.isArray(response.data.data) ? response.data.data : [];
};

/**
 * Upload a file resource to a workspace
 */
export const uploadWorkspaceResource = async (
  workspaceId: string,
  file: File,
  fileName?: string
): Promise<WorkspaceResource> => {
  const formData = new FormData();
  formData.append('file', file);
  if (fileName) {
    formData.append('file_name', fileName);
  }
  
  const response = await api.post<WorkspaceResourceResponse>(
    `/workspaces/${workspaceId}/resources`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  
  return response.data.data as WorkspaceResource;
};

/**
 * Update a workspace resource (rename)
 */
export const updateWorkspaceResource = async (
  workspaceId: string,
  resourceId: string,
  updates: { file_name?: string }
): Promise<WorkspaceResource> => {
  const response = await api.patch<WorkspaceResourceResponse>(
    `/workspaces/${workspaceId}/resources/${resourceId}`,
    updates
  );
  return response.data.data as WorkspaceResource;
};

/**
 * Delete a workspace resource
 */
export const deleteWorkspaceResource = async (
  workspaceId: string,
  resourceId: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/resources/${resourceId}`);
  } catch (error: any) {
    // Treat 404 as non-fatal (resource may have already been deleted)
    if (error?.response?.status === 404) {
      console.warn(`Workspace resource ${resourceId} not found (may have already been deleted)`);
      return;
    }
    // Rethrow any other errors
    throw error;
  }
};

/**
 * Get file URL for a workspace resource
 * Prefers the public file_url if available, otherwise falls back to proxy endpoint
 */
export const getWorkspaceResourceUrl = (resource: WorkspaceResource): string => {
  // Use public URL if available (direct access, faster)
  if (resource.file_url) {
    return resource.file_url;
  }
  // Fallback to proxy endpoint through Laravel
  return getFileUrl(resource.file_path);
};

