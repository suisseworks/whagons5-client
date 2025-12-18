import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Calendar } from "lucide-react";

interface DateFieldProps {
  isEditing?: boolean;
}

export function DateField({ isEditing = true }: DateFieldProps) {
  // State for preview input value
  const [value, setValue] = useState<string>("");

  // Show the actual date input in both edit and preview modes
  return (
    <div className="py-2">
      <div className="relative">
        <Input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
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

