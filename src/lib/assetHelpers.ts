import { uploadFile, getFileUrl, deleteFile, extractFileIdFromUrl, type UploadedFile } from '@/api/assetApi';

/**
 * Asset helper utilities for forms and general asset management
 */

export interface AssetUploadOptions {
  onProgress?: (progress: number) => void;
  maxSize?: number; // in bytes
  allowedTypes?: string[]; // MIME types
}

/**
 * Upload a file with validation and progress tracking
 */
export const uploadAsset = async (
  file: File,
  options: AssetUploadOptions = {}
): Promise<UploadedFile> => {
  const { maxSize, allowedTypes, onProgress } = options;

  // Validate file size
  if (maxSize && file.size > maxSize) {
    throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
  }

  // Validate file type
  if (allowedTypes && !allowedTypes.includes(file.type)) {
    throw new Error(`File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }

  // Upload the file
  const uploadedFile = await uploadFile(file);
  
  // Simulate progress if callback provided (since axios doesn't support upload progress for multipart)
  if (onProgress) {
    onProgress(100);
  }

  return uploadedFile;
};

/**
 * Upload an image asset (with image-specific validation)
 */
export const uploadImageAsset = async (
  file: File,
  options: Omit<AssetUploadOptions, 'allowedTypes'> = {}
): Promise<UploadedFile> => {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  
  return uploadAsset(file, {
    ...options,
    allowedTypes: imageTypes,
    maxSize: options.maxSize || 10 * 1024 * 1024, // Default 10MB for images
  });
};

/**
 * Upload a file asset (for non-image files)
 */
export const uploadFileAsset = async (
  file: File,
  options: AssetUploadOptions = {}
): Promise<UploadedFile> => {
  return uploadAsset(file, {
    ...options,
    maxSize: options.maxSize || 100 * 1024 * 1024, // Default 100MB for files
  });
};

/**
 * Get the asset ID from an UploadedFile object
 * Useful for storing in form field properties
 */
export const getAssetId = (file: UploadedFile): string => {
  return file.id;
};

/**
 * Get the display URL for an asset
 * This handles both asset URLs and regular URLs
 */
export const getAssetDisplayUrl = (urlOrId: string): string => {
  // If it's already a full URL, return it
  if (urlOrId.startsWith('http://') || urlOrId.startsWith('https://')) {
    return urlOrId;
  }

  // If it's an asset:// protocol, extract the ID
  if (urlOrId.startsWith('asset://')) {
    const fileId = extractFileIdFromUrl(urlOrId);
    return fileId ? getFileUrl(fileId) : urlOrId;
  }

  // If it looks like a file ID, construct the URL
  if (!urlOrId.includes('/') && !urlOrId.includes('.')) {
    return getFileUrl(urlOrId);
  }

  // Otherwise, assume it's already a relative URL
  return urlOrId;
};

/**
 * Delete an asset by URL or ID
 */
export const deleteAsset = async (urlOrId: string): Promise<void> => {
  const fileId = extractFileIdFromUrl(urlOrId) || urlOrId;
  await deleteFile(fileId);
};

/**
 * Validate if a file is an image
 */
export const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/');
};

/**
 * Validate if a file is a valid image type for upload
 */
export const isValidImageType = (file: File): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  return validTypes.includes(file.type);
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Create a preview URL for an image file (before upload)
 */
export const createImagePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

