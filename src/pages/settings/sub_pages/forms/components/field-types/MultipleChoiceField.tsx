import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";

interface MultipleChoiceFieldProps {
  options: string[];
  onOptionsChange: (options: string[]) => void;
  isEditing?: boolean;
  // Controlled mode props for form filling
  value?: string;
  onChange?: (value: string) => void;
}

export function MultipleChoiceField({ 
  options, 
  onOptionsChange, 
  isEditing = true,
  value: externalValue,
  onChange
}: MultipleChoiceFieldProps) {
  // Ensure at least one empty option exists
  const currentOptions = options.length > 0 ? options : [''];
  
  // Internal state for uncontrolled mode (preview)
  const [internalValue, setInternalValue] = useState<string>("");
  
  // Use external value if provided (controlled mode), otherwise internal
  const selectedValue = externalValue !== undefined ? externalValue : internalValue;
  
  const handleValueChange = (newValue: string) => {
    if (onChange) {
      onChange(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

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


  // Rendered view - what users see when filling the form
  if (!isEditing) {
    return (
      <div className="py-2">
        <Select value={selectedValue} onValueChange={handleValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {currentOptions.filter(opt => opt.trim()).map((option, index) => (
              <SelectItem key={index} value={option || `option-${index}`}>
                {option || `Option ${index + 1}`}
              </SelectItem>
            ))}
            {currentOptions.filter(opt => opt.trim()).length === 0 && (
              <SelectItem value="option-empty">Option 1</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Edit view - what form creator sees
  return (
    <div className="py-4 px-2 space-y-2.5 mt-0 pt-0 mb-2">
      <div className="max-h-48 overflow-y-auto space-y-2.5 pr-2">
        {currentOptions.map((option, index) => (
          <div key={index} className="flex items-center gap-3 group">
            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground flex-shrink-0 mt-2.5" />
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
        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground flex-shrink-0" />
        <div className="flex items-center gap-2 h-full">
          <button
            type="button"
            onClick={handleAddOption}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Add option or add "Other"
          </button>
        </div>
      </div>
    </div>
  );
}

