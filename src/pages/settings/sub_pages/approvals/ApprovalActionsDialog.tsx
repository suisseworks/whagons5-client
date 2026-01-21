import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, Save, Loader2 } from 'lucide-react';
import { ApprovalActionsManager } from './ApprovalActionsManager';
import { Approval } from '@/store/types';
import { genericActions } from '@/store/genericSlices';
import type { AppDispatch } from '@/store/store';
import { actionsApi } from '@/api/whagonsActionsApi';
import toast from 'react-hot-toast';

interface ApprovalActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approval: Approval | null;
}

export function ApprovalActionsDialog({ open, onOpenChange, approval }: ApprovalActionsDialogProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [approvedActions, setApprovedActions] = useState<any[]>([]);
  const [rejectedActions, setRejectedActions] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load actions when approval changes
  useEffect(() => {
    if (approval) {
      setApprovedActions((approval as any).on_approved_actions || []);
      setRejectedActions((approval as any).on_rejected_actions || []);
    } else {
      setApprovedActions([]);
      setRejectedActions([]);
    }
  }, [approval]);

  const handleSave = async (showSuccessToast = true, closeDialog = true, actionsToSave?: { approved: any[], rejected: any[] }) => {
    if (!approval) return;

    setIsSaving(true);
    try {
      const approvedToSave = actionsToSave?.approved ?? approvedActions;
      const rejectedToSave = actionsToSave?.rejected ?? rejectedActions;

      // Use the dedicated actions endpoint
      await actionsApi.put(`/approvals/${approval.id}/actions`, {
        on_approved_actions: approvedToSave,
        on_rejected_actions: rejectedToSave,
      });

      // Update local state; cache will be updated via realtime notifications / background validation
      dispatch((genericActions as any).approvals.updateItem({
        id: approval.id,
        on_approved_actions: approvedToSave,
        on_rejected_actions: rejectedToSave,
      }));

      if (showSuccessToast) {
        toast.success('Approval actions saved successfully');
      }
      if (closeDialog) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Failed to save approval actions:', error);
      toast.error('Failed to save approval actions');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-visible flex flex-col">
        <DialogHeader className="space-y-3 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Zap className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl truncate">
                {approval?.name}
              </DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Configure actions to execute automatically when this approval is approved or rejected
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 -mx-1">
          <ApprovalActionsManager
            approvedActions={approvedActions}
            rejectedActions={rejectedActions}
            onApprovedActionsChange={setApprovedActions}
            onRejectedActionsChange={setRejectedActions}
            onActionDeleted={async (updatedApproved, updatedRejected) => {
              // Auto-save immediately when an action is deleted
              await handleSave(false, false, {
                approved: updatedApproved,
                rejected: updatedRejected,
              });
            }}
            approvalId={approval?.id ?? null}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="min-w-24"
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleSave()}
            disabled={isSaving}
            className="min-w-32"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Actions
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
