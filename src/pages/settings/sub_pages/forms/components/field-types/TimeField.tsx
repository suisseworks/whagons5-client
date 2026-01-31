import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Clock } from "lucide-react";

interface TimeFieldProps {
  isEditing?: boolean;
  // Controlled mode props for form filling
  value?: string;
  onChange?: (value: string) => void;
}

export function TimeField({ 
  isEditing = true,
  value: externalValue,
  onChange
}: TimeFieldProps) {
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

  // Show the actual time input in both edit and preview modes
  return (
    <div className="py-2">
      <div className="relative">
        <Input
          type="time"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isEditing}
          className="pr-10"
        />
        <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

