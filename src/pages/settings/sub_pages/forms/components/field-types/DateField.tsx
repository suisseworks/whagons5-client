import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Calendar } from "lucide-react";

interface DateFieldProps {
  isEditing?: boolean;
  // Controlled mode props for form filling
  value?: string;
  onChange?: (value: string) => void;
}

export function DateField({ 
  isEditing = true,
  value: externalValue,
  onChange
}: DateFieldProps) {
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

  // Show the actual date input in both edit and preview modes
  return (
    <div className="py-2">
      <div className="relative">
        <Input
          type="date"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="pr-10"
          disabled={isEditing}
          onClick={(e) => {
            // Ensure the native date picker opens (only when not editing)
            if (!isEditing) {
              const input = e.currentTarget;
              if (input.showPicker) {
                input.showPicker();
              }
            }
          }}
        />
        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

