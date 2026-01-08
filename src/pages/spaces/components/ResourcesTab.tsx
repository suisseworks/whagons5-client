import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FilePlus2, File, Trash2, Download, Folder } from "lucide-react";
import {
  getWorkspaceResources,
  uploadWorkspaceResource,
  deleteWorkspaceResource,
  getWorkspaceResourceUrl,
  type WorkspaceResource,
} from "@/api/workspaceResourcesApi";

// Component for individual resource item with image preview support
function ResourceItem({
  item,
  isImage,
  imageUrl,
  onDownload,
  onDelete,
  humanSize,
}: {
  item: WorkspaceResource;
  isImage: boolean;
  imageUrl: string | null;
  onDownload: (item: WorkspaceResource) => void;
  onDelete: (id: string) => void;
  humanSize: (bytes: number) => string;
}) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex items-center justify-center w-12 h-12 rounded bg-accent overflow-hidden flex-shrink-0 border border-border">
        {isImage && imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={item.file_name}
            className="w-full h-full object-cover cursor-pointer"
            crossOrigin="anonymous"
            onError={() => {
              setImageError(true);
            }}
            onClick={() => window.open(imageUrl, '_blank')}
          />
        ) : (
          <File className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.file_name}</div>
        <div className="text-xs text-muted-foreground">
          {humanSize(item.file_size)} •{" "}
          {new Date(item.created_at).toLocaleString()}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDownload(item)}
          title="Download"
        >
          <Download className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(item.id.toString())}
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function ResourcesTab({ workspaceId }: { workspaceId: string | undefined }) {
  const [resources, setResources] = useState<WorkspaceResource[]>([]);
  const [creatingDocName, setCreatingDocName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load resources on mount
  useEffect(() => {
    if (workspaceId && workspaceId !== 'all' && !isNaN(Number(workspaceId))) {
      loadResources();
    }
  }, [workspaceId]);

  const loadResources = async () => {
    if (!workspaceId || workspaceId === 'all' || isNaN(Number(workspaceId))) return;
    
    try {
      setLoading(true);
      const data = await getWorkspaceResources(workspaceId);
      setResources(data);
    } catch (error: any) {
      setError(error?.response?.data?.message || "Failed to load resources");
      console.error("Failed to load resources:", error);
    } finally {
      setLoading(false);
    }
  };

  const onFilesSelected = async (files: FileList) => {
    if (!workspaceId || workspaceId === 'all' || isNaN(Number(workspaceId))) {
      setError("Valid workspace ID is required");
      return;
    }

    setUploading(true);
    const uploadPromises = Array.from(files).map(async (file) => {
      try {
        const resource = await uploadWorkspaceResource(workspaceId, file);
        return resource;
      } catch (error: any) {
        setError(`Failed to upload ${file.name}: ${error?.response?.data?.message || error.message}`);
        console.error("Upload failed:", error);
        return null;
      }
    });

    const uploadedResources = (await Promise.all(uploadPromises)).filter(
      (r) => r !== null
    ) as WorkspaceResource[];

    if (uploadedResources.length > 0) {
      setResources((prev) => [...uploadedResources, ...prev]);
      setError(null);
    }

    setUploading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length) {
      onFilesSelected(e.target.files);
      e.target.value = ""; // reset
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const createBlankDoc = async () => {
    if (!workspaceId || workspaceId === 'all' || isNaN(Number(workspaceId))) {
      setError("Valid workspace ID is required");
      return;
    }

    const name = creatingDocName.trim() || `Untitled Document ${resources.length + 1}`;
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    
    // Create a blank markdown file
    const blob = new Blob([""], { type: "text/markdown" });
    const file = new File([blob], fileName, { type: "text/markdown" });

    try {
      setUploading(true);
      const resource = await uploadWorkspaceResource(workspaceId, file, fileName);
      setResources((prev) => [resource, ...prev]);
      setCreatingDocName("");
      setError(null);
    } catch (error: any) {
      setError(error?.response?.data?.message || "Failed to create document");
      console.error("Failed to create document:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (resourceId: string) => {
    if (!workspaceId || workspaceId === 'all' || isNaN(Number(workspaceId))) return;

    try {
      await deleteWorkspaceResource(workspaceId, resourceId.toString());
      setResources((prev) => prev.filter((r) => r.id.toString() !== resourceId));
      setError(null);
    } catch (error: any) {
      setError(error?.response?.data?.message || "Failed to delete resource");
      console.error("Failed to delete resource:", error);
    }
  };

  const handleDownload = (resource: WorkspaceResource) => {
    const url = getWorkspaceResourceUrl(resource);
    window.open(url, "_blank");
  };

  const totalSize = useMemo(() => resources.reduce((s, r) => s + r.file_size, 0), [resources]);

  const humanSize = useCallback((bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  const isImageFile = useCallback((fileName: string, extension?: string): boolean => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
    const ext = (extension?.toLowerCase() || fileName.split('.').pop()?.toLowerCase() || '').trim();
    const isImage = imageExtensions.includes(ext);
    return isImage;
  }, []);

  const isValidWorkspace = workspaceId && workspaceId !== 'all' && !isNaN(Number(workspaceId));

  if (!isValidWorkspace) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-muted-foreground text-sm text-center p-4">
          Select a specific workspace to view resources.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading resources...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Colored Header */}
      <div className="bg-primary/10 border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-base">Resources</h2>
          {resources.length > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              {resources.length} {resources.length === 1 ? 'item' : 'items'} • {humanSize(totalSize)}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 mx-4 mt-2 rounded-md">
          {error}
        </div>
      )}

      {/* Main Resources List - Takes most space */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {resources.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-20">
            <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">No resources yet</p>
            <p className="text-xs">Upload files or create a document to get started</p>
          </div>
        ) : (
          <div className="divide-y">
            {resources.map((item) => {
              const isImage = isImageFile(item.file_name, item.file_extension);
              const imageUrl = isImage ? getWorkspaceResourceUrl(item) : null;
              
              return (
                <ResourceItem
                  key={item.id}
                  item={item}
                  isImage={isImage}
                  imageUrl={imageUrl}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  humanSize={humanSize}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Compact Upload Section at Bottom */}
      <div className="border-t bg-muted/30 px-4 py-3">
        <div
          className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30"
          } ${uploading || !workspaceId || workspaceId === 'all' || isNaN(Number(workspaceId)) ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary/50"}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && inputRef.current?.click()}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Input
                ref={inputRef as any}
                type="file"
                multiple
                className="hidden"
                onChange={handleInputChange}
                disabled={uploading || !workspaceId || workspaceId === 'all' || isNaN(Number(workspaceId))}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
                className="gap-1.5"
                disabled={uploading || !workspaceId || workspaceId === 'all' || isNaN(Number(workspaceId))}
              >
                <Upload className="w-4 h-4" />
                Upload Files
              </Button>

              <div className="h-6 w-px bg-border" />

              <Input
                placeholder="New document name"
                value={creatingDocName}
                onChange={(e) => setCreatingDocName(e.target.value)}
                className="h-9 w-48"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    createBlankDoc();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                disabled={uploading || !workspaceId || workspaceId === 'all' || isNaN(Number(workspaceId))}
              />
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  createBlankDoc();
                }}
                className="gap-1.5"
                disabled={uploading || !workspaceId || workspaceId === 'all' || isNaN(Number(workspaceId))}
              >
                <FilePlus2 className="w-4 h-4" />
                Create
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              {uploading ? (
                <span className="text-primary">Uploading...</span>
              ) : (
                "Drag & drop files here"
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
