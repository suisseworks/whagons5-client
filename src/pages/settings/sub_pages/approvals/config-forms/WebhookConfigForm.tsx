import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WebhookConfigFormProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

export function WebhookConfigForm({ config, onChange }: WebhookConfigFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="url">Webhook URL</Label>
        <Input
          id="url"
          type="url"
          value={config.url || ''}
          onChange={(e) => onChange({ ...config, url: e.target.value })}
          placeholder="https://api.example.com/webhook"
          required
        />
      </div>

      <div>
        <Label htmlFor="method">HTTP Method</Label>
        <Select
          value={config.method || 'POST'}
          onValueChange={(value) => onChange({ ...config, method: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="headers">Headers (JSON)</Label>
        <Textarea
          id="headers"
          value={config.headers ? JSON.stringify(config.headers, null, 2) : '{}'}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange({ ...config, headers: parsed });
            } catch (err) {
              // Allow invalid JSON while typing
              onChange({ ...config, headers: e.target.value });
            }
          }}
          placeholder={'{\n  "Authorization": "Bearer token",\n  "Content-Type": "application/json"\n}'}
          rows={4}
        />
      </div>

      <div>
        <Label htmlFor="payload">Payload (JSON)</Label>
        <Textarea
          id="payload"
          value={config.payload ? JSON.stringify(config.payload, null, 2) : '{}'}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange({ ...config, payload: parsed });
            } catch (err) {
              // Allow invalid JSON while typing
              onChange({ ...config, payload: e.target.value });
            }
          }}
          placeholder={'{\n  "event": "approval.completed",\n  "task_id": "{{task.id}}"\n}'}
          rows={6}
        />
      </div>

      <div>
        <Label htmlFor="timeout">Timeout (seconds)</Label>
        <Input
          id="timeout"
          type="number"
          value={config.timeout || 10}
          onChange={(e) => onChange({ ...config, timeout: parseInt(e.target.value) || 10 })}
          placeholder="10"
        />
      </div>
    </div>
  );
}
