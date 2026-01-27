import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useState, useMemo } from "react";

interface CheckboxFieldProps {
  options: string[];
  onOptionsChange: (options: string[]) => void;
  isEditing?: boolean;
  // Controlled mode props for form filling - array of checked option values
  value?: string[];
  onChange?: (value: string[]) => void;
}

export function CheckboxField({ 
  options, 
  onOptionsChange, 
  isEditing = true,
  value: externalValue,
  onChange
}: CheckboxFieldProps) {
  // Ensure at least one empty option exists
  const currentOptions = options.length > 0 ? options : [''];
  
  // Check if "Other" option exists in the current options
  const hasOther = currentOptions.some(option => option.toLowerCase() === 'other');
  
  // Internal state for uncontrolled mode (preview)
  const [internalChecked, setInternalChecked] = useState<Record<string, boolean>>({});
  
  // Convert external array value to record format for internal use
  const checkedValues = useMemo(() => {
    if (externalValue !== undefined) {
      return externalValue.reduce((acc, val) => ({ ...acc, [val]: true }), {} as Record<string, boolean>);
    }
    return internalChecked;
  }, [externalValue, internalChecked]);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...currentOptions];
    newOptions[index] = value;
    onOptionsChange(newOptions);
  };

  const handleAddOption = () => {
    const newOptions = [...currentOptions, ''];
    onOptionsChange(newOptions);
  };

  const handleRemoveOption = (index: number) => {
    if (currentOptions.length > 1) {
      const newOptions = currentOptions.filter((_, i) => i !== index);
      onOptionsChange(newOptions);
    }
  };

  const handleAddOther = () => {
    const newOptions = [...currentOptions, 'Other'];
    onOptionsChange(newOptions);
  };

  const handleCheckboxChange = (option: string, checked: boolean) => {
    if (onChange) {
      // Controlled mode: update as array
      const currentArray = externalValue || [];
      const newArray = checked
        ? [...currentArray, option]
        : currentArray.filter(v => v !== option);
      onChange(newArray);
    } else {
      // Uncontrolled mode: update internal record
      setInternalChecked(prev => ({
        ...prev,
        [option]: checked
      }));
    }
  };

  // Rendered view - what users see when filling the form
  if (!isEditing) {
    return (
      <div className="space-y-3 py-2">
        {currentOptions.filter(opt => opt.trim()).map((option, index) => (
          <div key={index} className="flex items-center space-x-2">
            <Checkbox
              id={`checkbox-${index}`}
              checked={checkedValues[option] || false}
              onCheckedChange={(checked) => handleCheckboxChange(option, checked as boolean)}
            />
            <Label htmlFor={`checkbox-${index}`} className="text-sm font-normal">
              {option || `Option ${index + 1}`}
            </Label>
          </div>
        ))}
        {currentOptions.filter(opt => opt.trim()).length === 0 && (
          <div className="flex items-center space-x-2">
            <Checkbox id="checkbox-empty" disabled />
            <Label htmlFor="checkbox-empty" className="text-sm font-normal text-muted-foreground">
              Option 1
            </Label>
          </div>
        )}
      </div>
    );
  }

  // Edit view - what form creator sees
  return (
    <div className="py-4 px-2 space-y-2.5 mt-0 pt-0 mb-2">
      <div className="max-h-48 overflow-y-auto space-y-2.5 pr-2">
        {currentOptions.map((option, index) => (
          <div key={index} className="flex items-center gap-3 group">
            <Checkbox disabled className="mt-2.5" />
            <Input
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              className="flex-1"
              placeholder={`Option ${index + 1}`}
            />
            {currentOptions.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveOption(index)}
              >
                <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      
      <div className="flex items-center gap-3 h-9">
        <Checkbox disabled />
        <div className="flex items-center gap-2 h-full">
          <button
            type="button"
            onClick={handleAddOption}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Add option
          </button>
          {!hasOther && (
            <>
              <span className="text-sm text-muted-foreground">or</span>
              <button
                type="button"
                onClick={handleAddOther}
                className="text-sm text-primary hover:underline"
              >
                add "Other"
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
