import { Button } from "@/components/ui/button";
import { BuilderSchemaField } from "./FormBuilder";

interface AddFieldToolbarProps {
  onAddField: (type: BuilderSchemaField['type']) => void;
}

export function AddFieldToolbar({ onAddField }: AddFieldToolbarProps) {
  const fieldTypes = [
    { type: 'text' as const, label: 'Short answer', icon: 'T' },
    { type: 'textarea' as const, label: 'Paragraph', icon: '¶' },
    { type: 'select' as const, label: 'Multiple choice', icon: '○' },
    { type: 'checkbox' as const, label: 'Checkbox', icon: '☑' },
  ];

  return (
    <div className="flex flex-col gap-1 p-2 bg-background rounded-lg border border-border shadow-sm">
      {fieldTypes.map(({ type, label, icon }) => (
        <Button
          key={type}
          variant="ghost"
          size="icon"
          onClick={() => onAddField(type)}
          className="w-10 h-10 hover:bg-muted"
          title={label}
        >
          <span className="w-5 h-5 flex items-center justify-center text-sm font-mono">
            {icon}
          </span>
        </Button>
      ))}
    </div>
  );
}

