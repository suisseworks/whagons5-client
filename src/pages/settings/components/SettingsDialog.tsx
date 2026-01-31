import React, { ReactNode, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faPlus, faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useLanguage } from "@/providers/LanguageProvider";

export type DialogType = 'create' | 'edit' | 'delete' | 'custom';

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: DialogType;
  title?: string;
  description?: string | ReactNode;
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
  footerActions?: ReactNode; // Optional extra buttons rendered near submit
  contentClassName?: string; // Optional className to adjust DialogContent width
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
  cancelText,
  submitIcon,
  entityName,
  entityData,
  renderEntityPreview,
  footerActions,
  contentClassName
}: SettingsDialogProps) {
  const { t } = useLanguage();
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
      case 'create': return isSubmitting ? t('common.creating', 'Creating...') : t('common.create', 'Create');
      case 'edit': return isSubmitting ? t('common.updating', 'Updating...') : t('common.update', 'Update');
      case 'delete': return isSubmitting ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete');
      default: return isSubmitting ? t('common.processing', 'Processing...') : t('common.submit', 'Submit');
    }
  };

  const getCancelText = () => {
    return cancelText || t('common.cancel', 'Cancel');
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
      <DialogContent className={`overflow-visible ${type === 'delete' ? "sm:max-w-[425px]" : "max-w-5xl"} ${contentClassName || ''}`}>
        <div className="flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="flex-shrink-0 mb-6 space-y-2 pb-4 border-b border-border/40">
            <DialogTitle className={`${type === 'delete' ? "flex items-center space-x-2" : ""} text-2xl font-extrabold tracking-tight`}>
              {type === 'delete' && <FontAwesomeIcon icon={faTrash} className="text-destructive" />}
              <span>{getDefaultTitle()}</span>
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground/80 leading-relaxed">
              {getDefaultDescription()}
            </DialogDescription>
          </DialogHeader>

          {type === 'delete' && entityData && renderEntityPreview && (
            <div className="py-4 flex-shrink-0">
              <div className="bg-muted rounded-lg p-4">
                {renderEntityPreview(entityData)}
              </div>
            </div>
          )}

          {(type === 'create' || type === 'edit' || type === 'custom') ? (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6">
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate onKeyDown={(e)=>{ if(e.key==='Enter' && (e.target as HTMLElement)?.tagName?.toLowerCase() !== 'textarea'){ e.preventDefault(); } }}>
                  {children}
                  <button type="submit" style={{ display: 'none' }} data-hidden-submit="true" />
                </form>
              </div>
              <DialogFooter className="flex-shrink-0 !flex-col !justify-start sm:!flex-col sm:!justify-start">
                {error && (
                  <div className="text-sm text-destructive mb-2 text-left mr-auto w-full">
                    {error || (typeof window !== 'undefined' && (window as any).__settings_error) || ''}
                  </div>
                )}
                <div className="flex items-center justify-between w-full gap-4">
                  <div className="flex items-center">
                    {footerActions ? footerActions : null}
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                      {getCancelText()}
                    </Button>
                    <Button
                      type="button"
                      onClick={submitNow}
                      variant={getSubmitVariant()}
                      disabled={isSubmitting || submitDisabled}
                      className={type === 'create' ? "bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98]" : type === 'edit' ? "font-semibold shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-[0.98]" : ""}
                    >
                      {isSubmitting ? (
                        <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                      ) : (
                        <FontAwesomeIcon icon={getDefaultIcon()} className="mr-2" />
                      )}
                      {getDefaultSubmitText()}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </>
          ) : (
            <DialogFooter className="flex-shrink-0 !flex-col !justify-start sm:!flex-col sm:!justify-start">
              {error && (
                <div className="text-sm text-destructive mb-2 text-left mr-auto w-full">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-between w-full gap-4">
                <div className="flex items-center">
                  {footerActions ? footerActions : null}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                    {getCancelText()}
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
                </div>
              </div>
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
