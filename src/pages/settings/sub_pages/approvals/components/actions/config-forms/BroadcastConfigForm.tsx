import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BroadcastConfigFormProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

export function BroadcastConfigForm({ config, onChange }: BroadcastConfigFormProps) {
  const recipientSelectionType = config.recipient_selection_type || 'role';
  const recipientConfig = config.recipient_config || {};

  const handleRecipientSelectionTypeChange = (value: string) => {
    // Reset recipient_config when type changes
    onChange({
      ...config,
      recipient_selection_type: value,
      recipient_config: {},
    });
  };

  const handleRecipientConfigChange = (field: string, value: any) => {
    onChange({
      ...config,
      recipient_config: {
        ...recipientConfig,
        [field]: value,
      },
    });
  };

  const renderRecipientConfigFields = () => {
    switch (recipientSelectionType) {
      case 'manual':
        return (
          <div>
            <Label htmlFor="manual_user_ids">User IDs (comma-separated)</Label>
            <Input
              id="manual_user_ids"
              value={(recipientConfig.manual_user_ids || []).join(', ')}
              onChange={(e) => {
                const ids = e.target.value
                  .split(',')
                  .map(id => parseInt(id.trim()))
                  .filter(id => !isNaN(id));
                handleRecipientConfigChange('manual_user_ids', ids);
              }}
              placeholder="e.g., 1, 2, 3"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Enter user IDs separated by commas
            </p>
          </div>
        );
      
      case 'role':
        return (
          <div>
            <Label htmlFor="roles">Roles (comma-separated)</Label>
            <Input
              id="roles"
              value={(recipientConfig.roles || []).join(', ')}
              onChange={(e) => {
                const roles = e.target.value
                  .split(',')
                  .map(role => role.trim())
                  .filter(role => role.length > 0);
                handleRecipientConfigChange('roles', roles);
              }}
              placeholder="e.g., admin, manager, supervisor"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Enter role names separated by commas
            </p>
          </div>
        );
      
      case 'team':
        return (
          <div>
            <Label htmlFor="teams">Team IDs (comma-separated)</Label>
            <Input
              id="teams"
              value={(recipientConfig.teams || []).join(', ')}
              onChange={(e) => {
                const teams = e.target.value
                  .split(',')
                  .map(id => parseInt(id.trim()))
                  .filter(id => !isNaN(id));
                handleRecipientConfigChange('teams', teams);
              }}
              placeholder="e.g., 1, 2, 3"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Enter team IDs separated by commas
            </p>
          </div>
        );
      
      case 'department':
        return (
          <div>
            <Label htmlFor="departments">Departments (comma-separated)</Label>
            <Input
              id="departments"
              value={(recipientConfig.departments || []).join(', ')}
              onChange={(e) => {
                const departments = e.target.value
                  .split(',')
                  .map(dept => dept.trim())
                  .filter(dept => dept.length > 0);
                handleRecipientConfigChange('departments', departments);
              }}
              placeholder="e.g., IT, HR, Operations"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Enter department names separated by commas
            </p>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={config.title || ''}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="Broadcast title"
          required
        />
        <p className="text-sm text-muted-foreground mt-1">
          Supports placeholders: {'{task_id}'}, {'{task_title}'}, {'{decision}'}, {'{decided_by}'}
        </p>
      </div>

      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          value={config.message || ''}
          onChange={(e) => onChange({ ...config, message: e.target.value })}
          placeholder="Broadcast message"
          rows={4}
          required
        />
        <p className="text-sm text-muted-foreground mt-1">
          Supports placeholders: {'{task_title}'}, {'{task_description}'}, {'{approver_comment}'}, etc.
        </p>
      </div>

      <div>
        <Label htmlFor="priority">Priority</Label>
        <Select
          value={config.priority || 'normal'}
          onValueChange={(value) => onChange({ ...config, priority: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="recipient_selection_type">Recipient Selection Type</Label>
        <Select
          value={recipientSelectionType}
          onValueChange={handleRecipientSelectionTypeChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual (Specific Users)</SelectItem>
            <SelectItem value="role">By Role</SelectItem>
            <SelectItem value="team">By Team</SelectItem>
            <SelectItem value="department">By Department</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {renderRecipientConfigFields()}

      <div>
        <Label htmlFor="reminder_interval_hours">Reminder Interval (hours)</Label>
        <Input
          id="reminder_interval_hours"
          type="number"
          value={config.reminder_interval_hours || 24}
          onChange={(e) => onChange({ ...config, reminder_interval_hours: parseInt(e.target.value) || 24 })}
          placeholder="24"
          min="1"
        />
        <p className="text-sm text-muted-foreground mt-1">
          How often to send reminders to recipients who haven't acknowledged
        </p>
      </div>

      <div>
        <Label htmlFor="due_date">Due Date (optional)</Label>
        <Input
          id="due_date"
          type="datetime-local"
          value={config.due_date || ''}
          onChange={(e) => onChange({ ...config, due_date: e.target.value })}
        />
        <p className="text-sm text-muted-foreground mt-1">
          When recipients should acknowledge by (leave empty for no deadline)
        </p>
      </div>
    </div>
  );
}

