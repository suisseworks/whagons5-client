import api from './whagonsApi';

export interface UploadedFile {
  id: string;
  url?: string;
  key?: string;
  bucket?: string;
  size: number;
  content_type?: string;
  imgproxy_url?: string;
}

export interface UploadResponse {
  data: UploadedFile;
  message: string;
  status: number;
}

export interface ListFilesResponse {
  files: UploadedFile[];
  total?: number;
}

/**
 * Upload a file to the asset storage service
 */
export const uploadFile = async (file: File): Promise<UploadedFile> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<UploadResponse>('/assets/upload', formData);

  // The backend wraps the response in { data, message, status }
  // The actual file object is in response.data.data
  return response.data.data;
};

/**
 * List all uploaded files
 */
export const listFiles = async (): Promise<UploadedFile[]> => {
  const response = await api.get<{ data: UploadedFile[]; message: string; status: number }>('/assets');
  // The backend wraps the response in { data, message, status }
  return response.data.data || [];
};

/**
 * Get file details by ID
 */
export const getFile = async (fileId: string): Promise<UploadedFile> => {
  const response = await api.get<{ data: UploadedFile; message: string; status: number }>(`/assets/${fileId}`);
  // The backend wraps the response in { data, message, status }
  return response.data.data;
};

/**
 * Get file URL (for direct access/display)
 */
export const getFileUrl = (fileId: string): string => {
  // Construct the URL to fetch the file through our backend proxy
  const baseURL = api.defaults.baseURL?.replace('/api', '') || '';
  return `${baseURL}/api/assets/${fileId}`;
};

/**
 * Delete a file by ID
 */
export const deleteFile = async (fileId: string): Promise<void> => {
  await api.delete(`/assets/${fileId}`);
};

/**
 * Check if a URL is an asset URL (for forms)
 */
export const isAssetUrl = (url: string): boolean => {
  return url.includes('/assets/') || url.startsWith('asset://');
};

/**
 * Extract file ID from asset URL
 */
export const extractFileIdFromUrl = (url: string): string | null => {
  // Handle both /api/assets/{id} and asset://{id} formats
  const match = url.match(/(?:assets\/|asset:\/\/)([^\/\?]+)/);
  return match ? match[1] : null;
};

