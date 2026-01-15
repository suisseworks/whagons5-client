import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faGripVertical, faToggleOn, faToggleOff, faEdit } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApprovalAction, ACTION_TYPE_LABELS, ACTION_TYPE_ICONS, ACTION_TYPE_COLORS } from './ApprovalActionTypes';
import { ActionEditor } from './ActionEditor';
import { AddActionButton } from './AddActionButton';

interface ApprovalActionsManagerProps {
  approvedActions: ApprovalAction[];
  rejectedActions: ApprovalAction[];
  onApprovedActionsChange: (actions: ApprovalAction[]) => void;
  onRejectedActionsChange: (actions: ApprovalAction[]) => void;
}

export function ApprovalActionsManager({
  approvedActions,
  rejectedActions,
  onApprovedActionsChange,
  onRejectedActionsChange,
}: ApprovalActionsManagerProps) {
  const [editingAction, setEditingAction] = useState<{ action: ApprovalAction; index: number; type: 'approved' | 'rejected' } | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

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
    const actions = type === 'approved' ? [...approvedActions] : [...rejectedActions];
    actions.splice(index, 1);
    
    // Reorder remaining actions
    actions.forEach((action, i) => {
      action.order = i;
    });

    if (type === 'approved') {
      onApprovedActionsChange(actions);
    } else {
      onRejectedActionsChange(actions);
    }
  };

  const handleToggleEnabled = (index: number, type: 'approved' | 'rejected') => {
    const actions = type === 'approved' ? [...approvedActions] : [...rejectedActions];
    actions[index].enabled = !actions[index].enabled;

    if (type === 'approved') {
      onApprovedActionsChange(actions);
    } else {
      onRejectedActionsChange(actions);
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
        {actions.map((action, index) => (
          <div
            key={index}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              action.enabled ? 'bg-background' : 'bg-muted/50 opacity-60'
            }`}
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
                <span className="font-medium">{ACTION_TYPE_LABELS[action.action]}</span>
                <Badge variant="outline" className="text-xs">
                  Order: {action.order + 1}
                </Badge>
              </div>
              {Object.keys(action.config).length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {JSON.stringify(action.config, null, 0).substring(0, 100)}...
                </div>
              )}
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleToggleEnabled(index, type)}
            >
              <FontAwesomeIcon
                icon={action.enabled ? faToggleOn : faToggleOff}
                className={action.enabled ? 'text-green-600' : 'text-gray-400'}
              />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleEditAction(action, index, type)}
            >
              <FontAwesomeIcon icon={faEdit} />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDeleteAction(index, type)}
            >
              <FontAwesomeIcon icon={faTrash} className="text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-green-600">Actions on Approved</CardTitle>
              <CardDescription>
                Actions to execute when the approval is approved
              </CardDescription>
            </div>
            <AddActionButton onSelectAction={(actionType) => handleAddAction(actionType, 'approved')} />
          </div>
        </CardHeader>
        <CardContent>
          {renderActionList(approvedActions, 'approved')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-red-600">Actions on Rejected</CardTitle>
              <CardDescription>
                Actions to execute when the approval is rejected
              </CardDescription>
            </div>
            <AddActionButton onSelectAction={(actionType) => handleAddAction(actionType, 'rejected')} />
          </div>
        </CardHeader>
        <CardContent>
          {renderActionList(rejectedActions, 'rejected')}
        </CardContent>
      </Card>

      {isEditorOpen && editingAction && (
        <ActionEditor
          action={editingAction.action}
          open={isEditorOpen}
          onOpenChange={setIsEditorOpen}
          onSave={handleSaveAction}
        />
      )}
    </div>
  );
}
