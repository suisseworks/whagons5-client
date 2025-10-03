import React, { ReactNode, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faPlus, faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export type DialogType = 'create' | 'edit' | 'delete' | 'custom';

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: DialogType;
  title?: string;
  description?: string;
  children?: ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  onConfirm?: () => void;
  isSubmitting?: boolean;
  error?: string | null;
  submitDisabled?: boolean;
  submitText?: string;
  cancelText?: string;
  submitIcon?: IconDefinition;
  entityName?: string; // For delete dialogs
  entityData?: any; // The item being deleted
  renderEntityPreview?: (data: any) => ReactNode; // Custom preview for delete dialog
}

export function SettingsDialog({
  open,
  onOpenChange,
  type,
  title,
  description,
  children,
  onSubmit,
  onConfirm,
  isSubmitting = false,
  error,
  submitDisabled = false,
  submitText,
  cancelText = "Cancel",
  submitIcon,
  entityName,
  entityData,
  renderEntityPreview
}: SettingsDialogProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitNow = () => {
    if (type === 'delete' && onConfirm) {
      onConfirm();
      return;
    }
    if (onSubmit) {
      const fakeEvent: any = {
        preventDefault: () => {},
        target: formRef.current,
        currentTarget: formRef.current,
      };
      onSubmit(fakeEvent as React.FormEvent);
    }
    // Optional: call component-provided direct saver if exposed
    const w: any = window as any;
    if (typeof w.saveEditsDirect === 'function') {
      try { w.saveEditsDirect(); } catch {}
    }
  };
  const getDefaultTitle = () => {
    switch (type) {
      case 'create': return title || 'Create Item';
      case 'edit': return title || 'Edit Item';
      case 'delete': return title || 'Delete Item';
      default: return title || 'Dialog';
    }
  };

  const getDefaultDescription = () => {
    switch (type) {
      case 'create': return description || 'Create a new item.';
      case 'edit': return description || 'Update the item information.';
      case 'delete': return description || `Are you sure you want to delete this ${entityName || 'item'}? This action cannot be undone.`;
      default: return description;
    }
  };

  const getDefaultSubmitText = () => {
    if (submitText) return submitText;
    switch (type) {
      case 'create': return isSubmitting ? 'Creating...' : 'Create';
      case 'edit': return isSubmitting ? 'Updating...' : 'Update';
      case 'delete': return isSubmitting ? 'Deleting...' : 'Delete';
      default: return isSubmitting ? 'Processing...' : 'Submit';
    }
  };

  const getDefaultIcon = () => {
    if (submitIcon) return submitIcon;
    switch (type) {
      case 'create': return faPlus;
      case 'edit': return faEdit;
      case 'delete': return faTrash;
      default: return faPlus;
    }
  };

  const getSubmitVariant = () => {
    return type === 'delete' ? 'destructive' : 'default';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'delete' && onConfirm) {
      onConfirm();
    } else if (onSubmit) {
      onSubmit(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={type === 'delete' ? "sm:max-w-[425px]" : "max-w-2xl"}>
        <DialogHeader>
          <DialogTitle className={type === 'delete' ? "flex items-center space-x-2" : ""}>
            {type === 'delete' && <FontAwesomeIcon icon={faTrash} className="text-destructive" />}
            <span>{getDefaultTitle()}</span>
          </DialogTitle>
          <DialogDescription>
            {getDefaultDescription()}
          </DialogDescription>
        </DialogHeader>

        {type === 'delete' && entityData && renderEntityPreview && (
          <div className="py-4">
            <div className="bg-muted rounded-lg p-4">
              {renderEntityPreview(entityData)}
            </div>
          </div>
        )}

        {(type === 'create' || type === 'edit' || type === 'custom') ? (
          <>
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate onKeyDown={(e)=>{ if(e.key==='Enter' && (e.target as HTMLElement)?.tagName?.toLowerCase() !== 'textarea'){ e.preventDefault(); } }}>
              {children}
              <button type="submit" style={{ display: 'none' }} data-hidden-submit="true" />
            </form>
            <DialogFooter>
              <div className="text-sm text-destructive mb-2 text-left mr-auto">
                {error || (typeof window !== 'undefined' && (window as any).__settings_error) || ''}
              </div>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                {cancelText}
              </Button>
              <Button
                type="button"
                onClick={submitNow}
                variant={getSubmitVariant()}
                disabled={isSubmitting || submitDisabled}
              >
                {isSubmitting ? (
                  <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                ) : (
                  <FontAwesomeIcon icon={getDefaultIcon()} className="mr-2" />
                )}
                {getDefaultSubmitText()}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter>
            {error && (
              <div className="text-sm text-destructive mb-2 text-left mr-auto">
                {error}
              </div>
            )}
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              {cancelText}
            </Button>
            <Button
              type="button"
              variant={getSubmitVariant()}
              onClick={onConfirm}
              disabled={isSubmitting || submitDisabled}
            >
              {isSubmitting ? (
                <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
              ) : (
                <FontAwesomeIcon icon={getDefaultIcon()} className="mr-2" />
              )}
              {getDefaultSubmitText()}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
