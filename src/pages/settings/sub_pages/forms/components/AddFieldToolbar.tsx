import { Button } from "@/components/ui/button";
import { Type, AlignLeft, List, CheckSquare } from "lucide-react";
import { BuilderSchemaField } from "./FormBuilder";

interface AddFieldToolbarProps {
  onAddField: (type: BuilderSchemaField['type']) => void;
}

export function AddFieldToolbar({ onAddField }: AddFieldToolbarProps) {
  const fieldTypes = [
    { type: 'text' as const, label: 'Short answer', icon: Type },
    { type: 'textarea' as const, label: 'Paragraph', icon: AlignLeft },
    { type: 'select' as const, label: 'Multiple choice', icon: List },
    { type: 'checkbox' as const, label: 'Checkbox', icon: CheckSquare },
  ];

  return (
    <div className="flex flex-col gap-1 bg-background rounded-lg border border-border shadow-sm">
      {fieldTypes.map(({ type, label, icon: Icon }) => (
        <Button
          key={type}
          variant="ghost"
          size="icon"
          onClick={() => onAddField(type)}
          className="w-10 h-10 hover:bg-muted"
          title={label}
        >
          <Icon className="w-6 h-6" />
        </Button>
      ))}
    </div>
  );
}

