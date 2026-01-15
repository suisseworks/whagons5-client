import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { Status } from '@/store/types';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StatusConfigFormProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

export function StatusConfigForm({ config, onChange }: StatusConfigFormProps) {
  const statuses = useSelector((s: RootState) => s.statuses?.value ?? []) as Status[];

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="status_id">Status</Label>
        <Select
          value={config.status_id ? String(config.status_id) : ''}
          onValueChange={(value) => onChange({ ...config, status_id: parseInt(value, 10) })}
        >
          <SelectTrigger id="status_id">
            <SelectValue placeholder="Select a status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((status) => (
              <SelectItem key={status.id} value={String(status.id)}>
                <div className="flex items-center gap-2">
                  {status.color && (
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: status.color }}
                    />
                  )}
                  <span>{status.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground mt-1">
          Select the status to change the task to
        </p>
      </div>

      <div>
        <Label htmlFor="comment">Comment (Optional)</Label>
        <Textarea
          id="comment"
          value={config.comment || ''}
          onChange={(e) => onChange({ ...config, comment: e.target.value })}
          placeholder="Enter an optional comment"
          rows={3}
        />
      </div>
    </div>
  );
}
