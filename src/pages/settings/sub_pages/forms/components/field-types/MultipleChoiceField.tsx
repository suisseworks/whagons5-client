import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

interface MultipleChoiceFieldProps {
  options: string[];
  onOptionsChange: (options: string[]) => void;
  isEditing?: boolean;
}

export function MultipleChoiceField({ options, onOptionsChange, isEditing = true }: MultipleChoiceFieldProps) {
  // Ensure at least one empty option exists
  const currentOptions = options.length > 0 ? options : [''];
  
  // Check if "Other" option exists in the current options
  const hasOther = currentOptions.some(option => option.toLowerCase() === 'other');

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

  // Rendered view - what users see when filling the form
  if (!isEditing) {
    return (
      <div className="space-y-2 py-2">
        {currentOptions.filter(opt => opt.trim()).map((option, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground flex-shrink-0" />
            <span className="text-sm">{option || `Option ${index + 1}`}</span>
          </div>
        ))}
        {currentOptions.filter(opt => opt.trim()).length === 0 && (
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">Option 1</span>
          </div>
        )}
      </div>
    );
  }

  // Edit view - what form creator sees
  return (
    <div className="py-4 px-2 space-y-2.5 mt-0 pt-0 mb-2">
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
      
      <div className="flex items-center gap-3 h-9">
        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground flex-shrink-0" />
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

