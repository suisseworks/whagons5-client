import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faXmark, faUpload, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { uploadImageAsset, getAssetDisplayUrl, createImagePreview } from "@/lib/assetHelpers";
import { Label } from "@/components/ui/label";

interface FixedImageFieldProps {
  isEditing?: boolean;
  imageUrl?: string | null;
  imageId?: string | null;
  onImageChange?: (value: { imageUrl: string | null; imageId?: string | null }) => void;
}

export function FixedImageField({ 
  isEditing = true,
  imageUrl,
  imageId,
  onImageChange
}: FixedImageFieldProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load preview for the fixed image
  useEffect(() => {
    if (imageUrl) {
      setPreview(getAssetDisplayUrl(imageUrl));
    } else if (imageId) {
      setPreview(getAssetDisplayUrl(imageId));
    } else {
      setPreview(null);
    }
  }, [imageUrl, imageId]);

  // Handle image upload for form builder
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      onImageChange?.({
        imageUrl: uploadedFile.url || null,
        imageId: uploadedFile.id
      });
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
    onImageChange?.({ imageUrl: null, imageId: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Form response view - display the fixed image
  if (!isEditing) {
    if (!imageUrl && !imageId) {
      return (
        <div className="py-2 text-sm text-muted-foreground">
          No image set
        </div>
      );
    }

    return (
      <div className="py-2">
        <img
          src={getAssetDisplayUrl(imageUrl || imageId!)}
          alt="Form image"
          className="max-w-full h-auto rounded-lg border border-border"
          style={{ maxHeight: '400px' }}
        />
      </div>
    );
  }

  // Form builder view - allow setting/editing the fixed image
  return (
    <div className="space-y-3 py-2">
      <div className="text-sm font-medium">Fixed Image Display</div>
      <div className="text-xs text-muted-foreground mb-2">
        Upload an image that will be displayed in the form. This image cannot be changed by users filling out the form.
      </div>
      
      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Fixed image preview"
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
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
            id="fixed-image-upload"
            disabled={uploading}
          />
          <label
            htmlFor="fixed-image-upload"
            className={`cursor-pointer flex flex-col items-center gap-2 ${uploading ? 'opacity-50' : ''}`}
          >
            {uploading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="h-6 w-6 text-muted-foreground animate-spin" />
                <span className="text-sm text-muted-foreground">Uploading...</span>
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faUpload} className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Upload image</span>
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

