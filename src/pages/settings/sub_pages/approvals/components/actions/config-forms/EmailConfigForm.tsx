import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';

interface EmailConfigFormProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

export function EmailConfigForm({ config, onChange }: EmailConfigFormProps) {
  const recipients = config.recipients || [];

  const handleAddRecipient = () => {
    onChange({
      ...config,
      recipients: [...recipients, { type: 'email', value: '' }],
    });
  };

  const handleRemoveRecipient = (index: number) => {
    const newRecipients = [...recipients];
    newRecipients.splice(index, 1);
    onChange({ ...config, recipients: newRecipients });
  };

  const handleRecipientChange = (index: number, field: string, value: any) => {
    const newRecipients = [...recipients];
    newRecipients[index] = { ...newRecipients[index], [field]: value };
    onChange({ ...config, recipients: newRecipients });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="template">Email Template</Label>
        <Input
          id="template"
          value={config.template || ''}
          onChange={(e) => onChange({ ...config, template: e.target.value })}
          placeholder="approval_notification"
        />
      </div>

      <div>
        <Label htmlFor="subject">Email Subject</Label>
        <Input
          id="subject"
          value={config.subject || ''}
          onChange={(e) => onChange({ ...config, subject: e.target.value })}
          placeholder="Task Approval Notification"
        />
      </div>

      <div>
        <Label>Recipients</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Add email recipients
        </p>
        <div className="space-y-2">
          {recipients.map((recipient: any, index: number) => (
            <div key={index} className="flex gap-2">
              <Select
                value={recipient.type || 'email'}
                onValueChange={(value) => handleRecipientChange(index, 'type', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="user">User ID</SelectItem>
                  <SelectItem value="role">Role</SelectItem>
                </SelectContent>
              </Select>

              <Input
                value={recipient.value || recipient.user_id || recipient.email || ''}
                onChange={(e) => {
                  const field = recipient.type === 'user' ? 'user_id' : 
                               recipient.type === 'role' ? 'value' : 'email';
                  handleRecipientChange(index, field, e.target.value);
                }}
                placeholder={
                  recipient.type === 'user' ? 'Enter user ID' :
                  recipient.type === 'role' ? 'Enter role name' :
                  'Enter email address'
                }
              />

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveRecipient(index)}
              >
                <FontAwesomeIcon icon={faTrash} />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={handleAddRecipient}>
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            Add Recipient
          </Button>
        </div>
      </div>
    </div>
  );
}

