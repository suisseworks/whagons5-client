import { useState, useRef, useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faXmark, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { uploadImageAsset, getAssetDisplayUrl, createImagePreview } from "@/lib/assetHelpers";

interface ImageFieldProps {
  isEditing?: boolean;
  // For form responses: uploaded image asset ID
  value?: string | null; // Asset ID of uploaded image
  onChange?: (assetId: string | null) => void;
}

export function ImageField({ 
  isEditing = true,
  value,
  onChange
}: ImageFieldProps) {
  const uniqueId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load preview for uploaded image
  useEffect(() => {
    if (value) {
      setPreview(getAssetDisplayUrl(value));
    } else {
      setPreview(null);
    }
  }, [value]);

  // Handle file upload for form responses (when user fills the form)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      // Create preview immediately
      const previewUrl = await createImagePreview(file);
      setPreview(previewUrl);

      // Upload to asset service
      const uploadedFile = await uploadImageAsset(file, {
        maxSize: 10 * 1024 * 1024, // 10MB
      });

      // Store the asset ID
      onChange?.(uploadedFile.id);
    } catch (error: any) {
      setUploadError(error.message || 'Failed to upload image');
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange?.(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Form response view - what users see when filling the form
  if (!isEditing) {
    return (
      <div className="py-2">
        {preview ? (
          <div className="relative inline-block">
            <img
              src={preview}
              alt="Upload preview"
              className="max-w-full h-auto rounded-lg border border-border"
              style={{ maxHeight: '300px' }}
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={handleRemove}
              disabled={uploading}
            >
              <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id={uniqueId}
              disabled={uploading}
            />
            <label
              htmlFor={uniqueId}
              className={`cursor-pointer flex flex-col items-center gap-2 ${uploading ? 'opacity-50' : ''}`}
            >
              {uploading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="h-8 w-8 text-muted-foreground animate-spin" />
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faImage} className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload an image</span>
                </>
              )}
            </label>
            {uploadError && (
              <div className="mt-2 text-sm text-destructive">{uploadError}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Form builder view - what form creator sees
  return (
    <div className="text-sm text-muted-foreground py-2">
      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
        <FontAwesomeIcon icon={faImage} className="h-6 w-6 text-muted-foreground mb-2" />
        <div>Image upload field</div>
        <div className="text-xs mt-1">Users can upload images when filling out this form</div>
      </div>
    </div>
  );
}
