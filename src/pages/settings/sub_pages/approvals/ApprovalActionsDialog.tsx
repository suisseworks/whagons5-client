import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faSave } from '@fortawesome/free-solid-svg-icons';
import { ApprovalActionsManager } from './ApprovalActionsManager';
import { Approval } from '@/store/types';
import { genericActions } from '@/store/genericSlices';
import type { AppDispatch } from '@/store/store';

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
      setApprovedActions(approval.on_approved_actions || []);
      setRejectedActions(approval.on_rejected_actions || []);
    } else {
      setApprovedActions([]);
      setRejectedActions([]);
    }
  }, [approval]);

  const handleSave = async () => {
    if (!approval) return;

    setIsSaving(true);
    try {
      await dispatch(
        genericActions.updateItem({
          entity: 'approvals',
          id: approval.id,
          data: {
            on_approved_actions: approvedActions,
            on_rejected_actions: rejectedActions,
          },
        })
      ).unwrap();

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save approval actions:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FontAwesomeIcon icon={faBolt} className="text-amber-600 w-5 h-5" />
            Approval Actions: {approval?.name}
          </DialogTitle>
          <DialogDescription>
            Configure actions to execute automatically when this approval is approved or rejected
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <ApprovalActionsManager
            approvedActions={approvedActions}
            rejectedActions={rejectedActions}
            onApprovedActionsChange={setApprovedActions}
            onRejectedActionsChange={setRejectedActions}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            <FontAwesomeIcon icon={faSave} className="mr-2" />
            {isSaving ? 'Saving...' : 'Save Actions'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
