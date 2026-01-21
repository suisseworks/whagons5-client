import React from "react";
import { ICellRendererParams } from 'ag-grid-community';
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export interface ActionButton {
  icon: IconDefinition;
  label?: string | ((data: any) => string | React.ReactNode);
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  onClick: (data: any) => void;
  className?: string | ((data: any) => string);
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

  const hasExplicitActions = Array.isArray(actions) && actions.length > 0;
  const leftActions = hasExplicitActions ? (actions as ActionButton[]) : customActions;
  const rightActions = hasExplicitActions ? [] : defaultActions;

  const handleAction = (action: ActionButton, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Radix/AG Grid can listen above React; stop the native event too
    (e.nativeEvent as any)?.stopImmediatePropagation?.();
    action.onClick(data);
  };

  const renderActionButton = (action: ActionButton, key: React.Key, keyPrefix = '') => {
    const computedLabel = typeof action.label === 'function' ? action.label(data) : action.label;
    const titleText = typeof computedLabel === 'string' ? computedLabel : undefined;
    const computedClassName = typeof action.className === 'function' ? action.className(data) : action.className;
    return (
      <Button
        key={`${keyPrefix}${key}`}
        size="sm"
        variant={action.variant || "outline"}
        data-grid-stop-row-click="true"
        onPointerDown={(e) => {
          // Prevent AG Grid from treating this as a row click (which would open Edit)
          e.preventDefault();
          e.stopPropagation();
          // Radix/AG Grid can listen above React; stop the native event too
          (e.nativeEvent as any)?.stopImmediatePropagation?.();
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          (e.nativeEvent as any)?.stopImmediatePropagation?.();
        }}
        onClick={(e) => handleAction(action, e)}
        className={computedClassName}
        disabled={action.disabled ? action.disabled(data) : false}
        title={titleText}
      >
        <FontAwesomeIcon icon={action.icon} className="w-3 h-3" />
        {computedLabel ? <span className="ml-1">{computedLabel}</span> : null}
        {action.renderExtra ? (
          <span className="ml-2">{action.renderExtra(data)}</span>
        ) : null}
      </Button>
    );
  };

  return (
    <div className="flex h-full w-full items-center justify-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {leftActions.map((action, index) => renderActionButton(action, index))}
        {rightActions.map((action, index) => renderActionButton(action, index, 'r-'))}
      </div>
    </div>
  );
}

export function createActionsCellRenderer(props: Omit<ActionsCellRendererProps, keyof ICellRendererParams>) {
  return (params: ICellRendererParams) => <ActionsCellRenderer {...params} {...props} />;
}

export default ActionsCellRenderer;
