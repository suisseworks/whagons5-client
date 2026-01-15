import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApprovalAction, ACTION_TYPE_LABELS } from './ApprovalActionTypes';
import { TagsConfigForm } from './config-forms/TagsConfigForm';
import { StatusConfigForm } from './config-forms/StatusConfigForm';
import { TaskConfigForm } from './config-forms/TaskConfigForm';
import { EmailConfigForm } from './config-forms/EmailConfigForm';
import { BoardMessageConfigForm } from './config-forms/BoardMessageConfigForm';
import { BroadcastConfigForm } from './config-forms/BroadcastConfigForm';
import { WebhookConfigForm } from './config-forms/WebhookConfigForm';

interface ActionEditorProps {
  action: ApprovalAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (action: ApprovalAction) => void;
}

export function ActionEditor({ action, open, onOpenChange, onSave }: ActionEditorProps) {
  const [editedAction, setEditedAction] = useState<ApprovalAction>(action);

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
        return <StatusConfigForm config={editedAction.config} onChange={handleConfigChange} />;
      
      case 'create_task':
        return <TaskConfigForm config={editedAction.config} onChange={handleConfigChange} />;
      
      case 'assign_user':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="user_id">User ID</Label>
              <Input
                id="user_id"
                type="number"
                value={editedAction.config.user_id || ''}
                onChange={(e) => handleConfigChange({ ...editedAction.config, user_id: parseInt(e.target.value) })}
                placeholder="Enter user ID"
              />
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
