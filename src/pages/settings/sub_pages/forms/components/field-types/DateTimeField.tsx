import { Input } from "@/components/ui/input";
import { useState } from "react";
import { CalendarClock } from "lucide-react";

interface DateTimeFieldProps {
  isEditing?: boolean;
}

export function DateTimeField({ isEditing = true }: DateTimeFieldProps) {
  // State for preview input value
  const [value, setValue] = useState<string>("");

  // Show the actual datetime input in both edit and preview modes
  return (
    <div className="py-2">
      <div className="relative">
        <Input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isEditing}
          className="pr-10"
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
        <CalendarClock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

