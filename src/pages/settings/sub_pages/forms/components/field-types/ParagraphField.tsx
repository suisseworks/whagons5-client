import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface ParagraphFieldProps {
  isEditing?: boolean;
  // Controlled mode props for form filling
  value?: string;
  onChange?: (value: string) => void;
}

export function ParagraphField({ 
  isEditing = true,
  value: externalValue,
  onChange
}: ParagraphFieldProps) {
  // Internal state for uncontrolled mode (preview)
  const [internalValue, setInternalValue] = useState<string>("");
  
  // Use external value if provided (controlled mode), otherwise internal
  const value = externalValue !== undefined ? externalValue : internalValue;
  
  const handleChange = (newValue: string) => {
    if (onChange) {
      onChange(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  // Rendered view - what users see when filling the form
  if (!isEditing) {
    return (
      <div className="py-2">
        <Textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
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
