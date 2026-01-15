import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BoardMessageConfigFormProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

export function BoardMessageConfigForm({ config, onChange }: BoardMessageConfigFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="board_id">Board ID</Label>
        <Input
          id="board_id"
          type="number"
          value={config.board_id || ''}
          onChange={(e) => onChange({ ...config, board_id: parseInt(e.target.value) || '' })}
          placeholder="Enter board ID"
          required
        />
        <p className="text-sm text-muted-foreground mt-1">
          The TeamConnect board to post the message to
        </p>
      </div>

      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          value={config.message || ''}
          onChange={(e) => onChange({ ...config, message: e.target.value })}
          placeholder="Enter message text"
          rows={4}
          required
        />
      </div>

      <div>
        <Label htmlFor="message_type">Message Type</Label>
        <Select
          value={config.message_type || 'text'}
          onValueChange={(value) => onChange({ ...config, message_type: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="announcement">Announcement</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="attach_task"
          checked={config.attach_task || false}
          onCheckedChange={(checked) => onChange({ ...config, attach_task: checked })}
        />
        <Label htmlFor="attach_task" className="cursor-pointer">
          Attach reference to the task
        </Label>
      </div>
    </div>
  );
}
