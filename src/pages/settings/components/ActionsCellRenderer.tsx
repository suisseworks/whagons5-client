import React from "react";
import { ICellRendererParams } from 'ag-grid-community';
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export interface ActionButton {
  icon: IconDefinition;
  label?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  onClick: (data: any) => void;
  className?: string;
  disabled?: (data: any) => boolean;
  renderExtra?: (data: any) => React.ReactNode;
}

export interface ActionsCellRendererProps extends ICellRendererParams {
  actions?: ActionButton[];
  onEdit?: (data: any) => void;
  onDelete?: (data: any) => void;
  customActions?: ActionButton[];
}

export function ActionsCellRenderer({
  data,
  actions,
  onEdit,
  onDelete,
  customActions = []
}: ActionsCellRendererProps) {
  // Default actions if not provided
  const defaultActions: ActionButton[] = [];
  
  if (onEdit) {
    defaultActions.push({
      icon: faEdit,
      variant: "outline",
      onClick: onEdit,
      className: "p-1 h-7 w-7"
    });
  }
  
  if (onDelete) {
    defaultActions.push({
      icon: faTrash,
      variant: "destructive",
      onClick: onDelete,
      className: "p-1 h-7 w-7"
    });
  }

  const allActions = actions || [...customActions, ...defaultActions];

  const handleAction = (action: ActionButton, e: React.MouseEvent) => {
    e.stopPropagation();
    action.onClick(data);
  };

  return (
    <div className="flex items-center space-x-2 h-full">
      {allActions.map((action, index) => (
        <Button
          key={index}
          size="sm"
          variant={action.variant || "outline"}
          onClick={(e) => handleAction(action, e)}
          className={action.className}
          disabled={action.disabled ? action.disabled(data) : false}
          title={action.label}
        >
          <FontAwesomeIcon icon={action.icon} className="w-3 h-3" />
          {action.label && <span className="ml-1">{action.label}</span>}
          {action.renderExtra ? (
            <span className="ml-2">{action.renderExtra(data)}</span>
          ) : null}
        </Button>
      ))}
    </div>
  );
}

// Helper function to create actions cell renderer
export function createActionsCellRenderer(props: Omit<ActionsCellRendererProps, keyof ICellRendererParams>) {
  return (params: ICellRendererParams) => <ActionsCellRenderer {...params} {...props} />;
}

export default ActionsCellRenderer;
