import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Clock } from "lucide-react";

interface TimeFieldProps {
  isEditing?: boolean;
}

export function TimeField({ isEditing = true }: TimeFieldProps) {
  // State for preview input value
  const [value, setValue] = useState<string>("");

  // Show the actual time input in both edit and preview modes
  return (
    <div className="py-2">
      <div className="relative">
        <Input
          type="time"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isEditing}
          className="pr-10"
        />
        <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

