import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApprovalAction, ACTION_TYPE_LABELS } from './ApprovalActionTypes';
import { TagsConfigForm } from './config-forms/TagsConfigForm';
import { StatusConfigForm } from './config-forms/StatusConfigForm';
import { TaskConfigForm } from './config-forms/TaskConfigForm';
import { EmailConfigForm } from './config-forms/EmailConfigForm';
import { BoardMessageConfigForm } from './config-forms/BoardMessageConfigForm';
import { BroadcastConfigForm } from './config-forms/BroadcastConfigForm';
import { WebhookConfigForm } from './config-forms/WebhookConfigForm';
import { RootState } from '@/store/store';
import { User } from '@/store/types';

interface ActionEditorProps {
  action: ApprovalAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (action: ApprovalAction) => void;
  approvalId?: number | null;
}

export function ActionEditor({ action, open, onOpenChange, onSave, approvalId }: ActionEditorProps) {
  const [editedAction, setEditedAction] = useState<ApprovalAction>(action);
  const users = useSelector((state: RootState) => (state as any).users?.value ?? []) as User[];
  const enabledUsers = useMemo(() => {
    return (users || [])
      .filter((user) => user?.is_active !== false)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [users]);

  useEffect(() => {
    setEditedAction(action);
  }, [action]);

  const handleConfigChange = (config: Record<string, any>) => {
    setEditedAction({ ...editedAction, config });
  };

  const handleSave = () => {
    onSave(editedAction);
  };

  const renderConfigForm = () => {
    switch (editedAction.action) {
      case 'add_tags':
        return <TagsConfigForm config={editedAction.config} onChange={handleConfigChange} actionType="add_tags" />;
      
      case 'remove_tags':
        return <TagsConfigForm config={editedAction.config} onChange={handleConfigChange} actionType="remove_tags" />;
      
      case 'change_status':
        return <StatusConfigForm config={editedAction.config} onChange={handleConfigChange} approvalId={approvalId} />;
      
      case 'create_task':
        return <TaskConfigForm config={editedAction.config} onChange={handleConfigChange} />;
      
      case 'assign_user':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="user_id">User ID</Label>
              <Select
                value={editedAction.config.user_id ? String(editedAction.config.user_id) : ''}
                onValueChange={(value) => {
                  if (!value) {
                    handleConfigChange({ ...editedAction.config, user_id: undefined });
                    return;
                  }
                  handleConfigChange({ ...editedAction.config, user_id: Number(value) });
                }}
              >
                <SelectTrigger id="user_id">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {enabledUsers.length === 0 ? (
                    <div className="px-2 py-1 text-sm text-muted-foreground">
                      No enabled users found
                    </div>
                  ) : (
                    enabledUsers.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name}{user.email ? ` (${user.email})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      
      case 'update_field':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="field">Field Name</Label>
              <Select
                value={editedAction.config.field || ''}
                onValueChange={(value) => handleConfigChange({ ...editedAction.config, field: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="description">Description</SelectItem>
                  <SelectItem value="due_date">Due Date</SelectItem>
                  <SelectItem value="estimated_hours">Estimated Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={editedAction.config.value || ''}
                onChange={(e) => handleConfigChange({ ...editedAction.config, value: e.target.value })}
                placeholder="Enter new value"
              />
            </div>
          </div>
        );
      
      case 'send_email':
        return <EmailConfigForm config={editedAction.config} onChange={handleConfigChange} />;
      
      case 'create_board_message':
        return <BoardMessageConfigForm config={editedAction.config} onChange={handleConfigChange} />;
      
      case 'create_broadcast':
        return <BroadcastConfigForm config={editedAction.config} onChange={handleConfigChange} />;
      
      case 'send_webhook':
        return <WebhookConfigForm config={editedAction.config} onChange={handleConfigChange} />;
      
      default:
        return <div className="text-muted-foreground">No configuration needed for this action type.</div>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Action: {ACTION_TYPE_LABELS[editedAction.action]}</DialogTitle>
          <DialogDescription>
            Configure the settings for this action
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {renderConfigForm()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
