import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FilePlus2, File, FolderPlus } from "lucide-react";

interface ResourceItem {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
}

export default function ResourcesTab({ workspaceId }: { workspaceId: string | undefined }) {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [creatingDocName, setCreatingDocName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFilesSelected = (files: FileList) => {
    const next: ResourceItem[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      type: f.type || "application/octet-stream",
      createdAt: new Date().toISOString()
    }));
    setResources(prev => [...next, ...prev]);
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

  const createBlankDoc = () => {
    const name = creatingDocName.trim() || `Untitled Document ${resources.length + 1}`;
    setResources(prev => [{
      id: crypto.randomUUID(),
      name: name.endsWith(".md") ? name : `${name}.md`,
      size: 0,
      type: "text/markdown",
      createdAt: new Date().toISOString()
    }, ...prev]);
    setCreatingDocName("");
  };

  const totalSize = useMemo(() => resources.reduce((s, r) => s + r.size, 0), [resources]);

  const humanSize = useCallback((bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  return (
    <div className="h-full w-full flex flex-col gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <FolderPlus className="w-4 h-4" />
        <span>Space Resources (mock)</span>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Create or Upload</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef as any}
                type="file"
                multiple
                className="hidden"
                onChange={handleInputChange}
              />
              <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} className="gap-1">
                <Upload className="w-4 h-4" />
                Upload
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="New document name"
                value={creatingDocName}
                onChange={(e) => setCreatingDocName(e.target.value)}
                className="h-9 w-56"
                onKeyDown={(e) => { if (e.key === "Enter") createBlankDoc(); }}
              />
              <Button size="sm" onClick={createBlankDoc} className="gap-1">
                <FilePlus2 className="w-4 h-4" />
                Create
              </Button>
            </div>

            <div className="ml-auto text-xs text-muted-foreground">
              {resources.length} items • {humanSize(totalSize)}
            </div>
          </div>

          <div
            className={`mt-2 border rounded-md p-6 text-center transition-colors ${isDragging ? "bg-accent" : "bg-background"}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Upload className="w-4 h-4" />
              Drag & drop files here to upload to this space
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle className="text-base">Resources</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 h-full overflow-auto">
          {resources.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-10">
              No resources yet. Upload files or create a document to get started.
            </div>
          ) : (
            <div className="divide-y">
              {resources.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded bg-accent">
                    <File className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {item.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {humanSize(item.size)} • {new Date(item.createdAt).toLocaleString()} • space {workspaceId ?? ""}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost">Open</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


