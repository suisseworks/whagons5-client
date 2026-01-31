import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

interface ShortAnswerFieldProps {
  isEditing?: boolean;
  // Controlled mode props for form filling
  value?: string;
  onChange?: (value: string) => void;
}

export function ShortAnswerField({ 
  isEditing = true,
  value: externalValue,
  onChange
}: ShortAnswerFieldProps) {
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
        <Input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
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
