import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TaskConfigFormProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

export function TaskConfigForm({ config, onChange }: TaskConfigFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title">Task Title</Label>
        <Input
          id="title"
          value={config.title || ''}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="Enter task title"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={config.description || ''}
          onChange={(e) => onChange({ ...config, description: e.target.value })}
          placeholder="Enter task description"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category_id">Category ID</Label>
          <Input
            id="category_id"
            type="number"
            value={config.category_id || ''}
            onChange={(e) => onChange({ ...config, category_id: parseInt(e.target.value) || '' })}
            placeholder="Inherit from original"
          />
        </div>

        <div>
          <Label htmlFor="status_id">Status ID</Label>
          <Input
            id="status_id"
            type="number"
            value={config.status_id || ''}
            onChange={(e) => onChange({ ...config, status_id: parseInt(e.target.value) || '' })}
            placeholder="Enter status ID"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="assigned_to">Assign To User ID</Label>
          <Input
            id="assigned_to"
            type="number"
            value={config.assigned_to || ''}
            onChange={(e) => onChange({ ...config, assigned_to: parseInt(e.target.value) || '' })}
            placeholder="Enter user ID"
          />
        </div>

        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={config.priority || 'medium'}
            onValueChange={(value) => onChange({ ...config, priority: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="due_date_offset_days">Due Date (Days from now)</Label>
        <Input
          id="due_date_offset_days"
          type="number"
          value={config.due_date_offset_days || ''}
          onChange={(e) => onChange({ ...config, due_date_offset_days: parseInt(e.target.value) || '' })}
          placeholder="e.g., 7 for one week"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="link_as_subtask"
            checked={config.link_as_subtask || false}
            onCheckedChange={(checked) => onChange({ ...config, link_as_subtask: checked })}
          />
          <Label htmlFor="link_as_subtask" className="cursor-pointer">
            Create as subtask of original task
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="inherit_tags"
            checked={config.inherit_tags || false}
            onCheckedChange={(checked) => onChange({ ...config, inherit_tags: checked })}
          />
          <Label htmlFor="inherit_tags" className="cursor-pointer">
            Inherit tags from original task
          </Label>
        </div>
      </div>
    </div>
  );
}
