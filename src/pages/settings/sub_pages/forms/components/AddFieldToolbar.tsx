import { Button } from "@/components/ui/button";
import { Type, AlignLeft, List, CheckSquare, Calendar, ChevronDown, Hash, Clock, CalendarClock, PenTool, Image, ImageIcon } from "lucide-react";
import { BuilderSchemaField } from "./FormBuilder";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AddFieldToolbarProps {
  onAddField: (type: BuilderSchemaField['type']) => void;
}

export function AddFieldToolbar({ onAddField }: AddFieldToolbarProps) {
  // Main 4 types shown in horizontal toolbar
  const mainFieldTypes = [
    { type: 'text' as const, label: 'Short answer', icon: Type },
    { type: 'textarea' as const, label: 'Paragraph', icon: AlignLeft },
    { type: 'select' as const, label: 'Multiple choice', icon: List },
    { type: 'checkbox' as const, label: 'Multi-select', icon: CheckSquare },
  ];

  // All available field types (including the main 4)
  const allFieldTypes = [
    { type: 'text' as const, label: 'Short answer', icon: Type },
    { type: 'textarea' as const, label: 'Paragraph', icon: AlignLeft },
    { type: 'select' as const, label: 'Multiple choice', icon: List },
    { type: 'checkbox' as const, label: 'Multi-select', icon: CheckSquare },
    { type: 'date' as const, label: 'Date', icon: Calendar },
    { type: 'number' as const, label: 'Number', icon: Hash },
    { type: 'time' as const, label: 'Time', icon: Clock },
    { type: 'datetime' as const, label: 'Date & Time', icon: CalendarClock },
    { type: 'signature' as const, label: 'Signature', icon: PenTool },
    { type: 'image' as const, label: 'Image Upload', icon: Image },
    { type: 'fixed-image' as const, label: 'Fixed Image', icon: ImageIcon },
  ];

  return (
    <div className="flex flex-col gap-1 bg-background rounded-lg border border-border shadow-sm">
      {mainFieldTypes.map(({ type, label, icon: Icon }) => (
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 hover:bg-muted"
            title="More field types"
          >
            <ChevronDown className="w-6 h-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {allFieldTypes.map(({ type, label, icon: Icon }) => (
            <DropdownMenuItem
              key={type}
              onClick={() => onAddField(type)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

