import { useState } from 'react';
import { useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faGripVertical, faEdit } from '@fortawesome/free-solid-svg-icons';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/animated/Tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ApprovalAction, ACTION_TYPE_LABELS, ACTION_TYPE_ICONS, ACTION_TYPE_COLORS } from './ApprovalActionTypes';
import { ActionEditor } from './ActionEditor';
import { AddActionButton } from './AddActionButton';
import { RootState } from '@/store/store';

interface ApprovalActionsManagerProps {
  approvedActions: ApprovalAction[];
  rejectedActions: ApprovalAction[];
  onApprovedActionsChange: (actions: ApprovalAction[]) => void;
  onRejectedActionsChange: (actions: ApprovalAction[]) => void;
  onActionDeleted?: (updatedApproved: ApprovalAction[], updatedRejected: ApprovalAction[]) => void | Promise<void>;
  approvalId?: number | null;
}

export function ApprovalActionsManager({
  approvedActions,
  rejectedActions,
  onApprovedActionsChange,
  onRejectedActionsChange,
  onActionDeleted,
  approvalId,
}: ApprovalActionsManagerProps) {
  const [editingAction, setEditingAction] = useState<{ action: ApprovalAction; index: number; type: 'approved' | 'rejected' } | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deletingAction, setDeletingAction] = useState<{ index: number; type: 'approved' | 'rejected' } | null>(null);

  // Get data from Redux to display names
  const statuses = useSelector((state: RootState) => (state as any).statuses?.value || []);
  const tags = useSelector((state: RootState) => (state as any).tags?.value || []);
  const users = useSelector((state: RootState) => (state as any).users?.value || []);

  const handleAddAction = (actionType: string, targetType: 'approved' | 'rejected') => {
    const newAction: ApprovalAction = {
      action: actionType as any,
      enabled: true,
      order: targetType === 'approved' ? approvedActions.length : rejectedActions.length,
      config: {},
    };

    setEditingAction({ action: newAction, index: -1, type: targetType });
    setIsEditorOpen(true);
  };

  const handleEditAction = (action: ApprovalAction, index: number, type: 'approved' | 'rejected') => {
    setEditingAction({ action: { ...action }, index, type });
    setIsEditorOpen(true);
  };

  const handleSaveAction = (updatedAction: ApprovalAction) => {
    if (!editingAction) return;

    const { index, type } = editingAction;
    const actions = type === 'approved' ? [...approvedActions] : [...rejectedActions];
    
    if (index === -1) {
      // Adding new action
      actions.push(updatedAction);
    } else {
      // Updating existing action
      actions[index] = updatedAction;
    }

    if (type === 'approved') {
      onApprovedActionsChange(actions);
    } else {
      onRejectedActionsChange(actions);
    }

    setIsEditorOpen(false);
    setEditingAction(null);
  };

  const handleDeleteAction = (index: number, type: 'approved' | 'rejected') => {
    setDeletingAction({ index, type });
  };

  const confirmDeleteAction = async () => {
    if (!deletingAction) return;

    const { index, type } = deletingAction;
    const actions = type === 'approved' ? [...approvedActions] : [...rejectedActions];
    actions.splice(index, 1);
    
    // Reorder remaining actions - create new objects to ensure React detects the change
    const reorderedActions = actions.map((action, i) => ({
      ...action,
      order: i,
    }));

    // Update state
    const updatedApproved = type === 'approved' ? reorderedActions : approvedActions;
    const updatedRejected = type === 'rejected' ? reorderedActions : rejectedActions;

    if (type === 'approved') {
      onApprovedActionsChange(reorderedActions);
    } else {
      onRejectedActionsChange(reorderedActions);
    }

    setDeletingAction(null);

    // Trigger auto-save callback if provided, passing the updated actions
    if (onActionDeleted) {
      await onActionDeleted(updatedApproved, updatedRejected);
    }
  };

  // Get display text for action config
  const getActionDetails = (action: ApprovalAction): string => {
    const config = action.config || {};
    
    switch (action.action) {
      case 'change_status':
        if (config.status_id) {
          const status = statuses.find((s: any) => s.id === config.status_id);
          return status?.name || `Status #${config.status_id}`;
        }
        return '';
      
      case 'add_tags':
      case 'remove_tags':
        if (config.tag_ids && Array.isArray(config.tag_ids)) {
          const tagNames = config.tag_ids
            .map((id: number) => {
              const tag = tags.find((t: any) => t.id === id);
              return tag?.name || `Tag #${id}`;
            })
            .filter(Boolean);
          return tagNames.join(', ');
        }
        return '';
      
      case 'assign_user':
        if (config.user_id) {
          const user = users.find((u: any) => u.id === config.user_id);
          return user?.name || `User #${config.user_id}`;
        }
        return '';
      
      case 'update_field':
        if (config.field) {
          // Format field name: convert snake_case to Title Case
          const fieldName = config.field
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          return fieldName;
        }
        return '';
      
      case 'send_email':
        return config.recipient || '';
      
      case 'create_board_message':
        return config.message ? config.message.substring(0, 50) + '...' : '';
      
      default:
        return '';
    }
  };

  const renderActionList = (actions: ApprovalAction[], type: 'approved' | 'rejected') => {
    if (actions.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          No actions configured
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {actions.map((action, index) => {
          const details = getActionDetails(action);
          
          return (
            <div
              key={`${type}-${action.action}-${index}-${action.order}`}
              className="flex items-center gap-3 p-3 rounded-lg border bg-background"
            >
              <div className="cursor-move text-muted-foreground">
                <FontAwesomeIcon icon={faGripVertical} />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon 
                    icon={ACTION_TYPE_ICONS[action.action]} 
                    className={`text-lg ${ACTION_TYPE_COLORS[action.action]}`} 
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{ACTION_TYPE_LABELS[action.action]}</span>
                    {details && (
                      <span className="text-sm text-muted-foreground">{details}</span>
                    )}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditAction(action, index, type);
                }}
              >
                <FontAwesomeIcon icon={faEdit} />
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteAction(index, type);
                }}
              >
                <FontAwesomeIcon icon={faTrash} className="text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Approval Actions</CardTitle>
          <CardDescription>
            Configure actions to execute automatically when this approval is approved or rejected
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="approved" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="approved" className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Approved
              </TabsTrigger>
              <TabsTrigger value="rejected" className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                Rejected
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="approved" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Actions to execute when the approval is approved
                </p>
                <AddActionButton onSelectAction={(actionType) => handleAddAction(actionType, 'approved')} />
              </div>
              {renderActionList(approvedActions, 'approved')}
            </TabsContent>
            
            <TabsContent value="rejected" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Actions to execute when the approval is rejected
                </p>
                <AddActionButton onSelectAction={(actionType) => handleAddAction(actionType, 'rejected')} />
              </div>
              {renderActionList(rejectedActions, 'rejected')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {isEditorOpen && editingAction && (
        <ActionEditor
          action={editingAction.action}
          open={isEditorOpen}
          onOpenChange={setIsEditorOpen}
          onSave={handleSaveAction}
          approvalId={approvalId}
        />
      )}

      <AlertDialog open={deletingAction !== null} onOpenChange={(open) => !open && setDeletingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this action? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
