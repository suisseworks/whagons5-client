import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface ParagraphFieldProps {
  isEditing?: boolean;
}

export function ParagraphField({ isEditing = true }: ParagraphFieldProps) {
  // State for preview textarea value
  const [value, setValue] = useState<string>("");

  // Rendered view - what users see when filling the form
  if (!isEditing) {
    return (
      <div className="py-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Long answer"
          rows={4}
        />
      </div>
    );
  }

  // Edit view - what form creator sees
  return (
    <div className="text-sm text-muted-foreground px-3 py-2 border rounded bg-muted/30">
      Long answer text
    </div>
  );
}
