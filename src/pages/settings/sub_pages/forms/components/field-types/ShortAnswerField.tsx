import { Input } from "@/components/ui/input";
import { useState } from "react";

interface ShortAnswerFieldProps {
  isEditing?: boolean;
}

export function ShortAnswerField({ isEditing = true }: ShortAnswerFieldProps) {
  // State for preview input value
  const [value, setValue] = useState<string>("");

  // Rendered view - what users see when filling the form
  if (!isEditing) {
    return (
      <div className="py-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Short answer"
        />
      </div>
    );
  }

  // Edit view - what form creator sees
  return (
    <div className="text-sm text-muted-foreground py-2">
      Short answer text
    </div>
  );
}
