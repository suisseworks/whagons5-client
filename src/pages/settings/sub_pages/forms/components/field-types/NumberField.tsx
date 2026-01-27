import { NumberSelector } from "@/components/NumberSelector";
import { useState } from "react";
import { Hash } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface NumberFieldProps {
  isEditing?: boolean;
  // Controlled mode props for form filling
  value?: number;
  onChange?: (value: number) => void;
  // Config from form field properties
  allowDecimals?: boolean;
}

export function NumberField({ 
  isEditing = true,
  value: externalValue,
  onChange,
  allowDecimals
}: NumberFieldProps) {
  // Internal state for uncontrolled mode (preview)
  const [internalValue, setInternalValue] = useState<number>(0);
  // State for integer vs float mode (false = integer, true = float)
  const [isFloat, setIsFloat] = useState<boolean>(allowDecimals ?? false);
  
  // Use external value if provided (controlled mode), otherwise internal
  const value = externalValue !== undefined ? externalValue : internalValue;

  // Transform function to ensure values are always rounded to step increment
  const transformValue = (val: number): number => {
    if (isFloat) {
      // Round to 2 decimal places (step of 0.01)
      return Math.round(val * 100) / 100;
    } else {
      // Round to nearest integer (step of 1)
      return Math.round(val);
    }
  };

  // Round to step increment to ensure proper decimal handling
  const handleValueChange = (newValue: number) => {
    // NumberSelector now handles empty input internally, so we always get a valid number
    // If it's 0 from empty input, that's fine - user can type over it
    const transformed = transformValue(newValue);
    if (onChange) {
      onChange(transformed);
    } else {
      setInternalValue(transformed);
    }
  };

  // When switching modes, round the current value appropriately
  const handleModeChange = (checked: boolean) => {
    setIsFloat(checked);
    const newValue = checked 
      ? Math.round(value * 100) / 100  // Switching to float: round to 2 decimal places
      : Math.round(value);              // Switching to integer: round to nearest integer
    
    if (onChange) {
      onChange(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  // Show the actual number input in both edit and preview modes
  return (
    <div className="py-2 space-y-2">
      <div className="relative">
        <NumberSelector
          value={value}
          onChange={handleValueChange}
          disabled={isEditing}
          className="pr-10"
          step={isFloat ? 0.01 : 1}
          transformValue={transformValue}
        />
        <Hash className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
      {isEditing && (
        <div className="flex items-center gap-2 pt-1">
          <Switch
            id="number-type-toggle"
            checked={isFloat}
            onCheckedChange={handleModeChange}
          />
          <Label htmlFor="number-type-toggle" className="text-sm text-muted-foreground cursor-pointer">
            Allow decimals (max 2 places)
          </Label>
        </div>
      )}
    </div>
  );
}

