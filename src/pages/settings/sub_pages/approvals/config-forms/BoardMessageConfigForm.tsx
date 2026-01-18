import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RootState } from '@/store/store';
import { Board } from '@/store/types';

interface BoardMessageConfigFormProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

export function BoardMessageConfigForm({ config, onChange }: BoardMessageConfigFormProps) {
  const boards = useSelector((state: RootState) => (state as any).boards?.value ?? []) as Board[];
  const sortedBoards = useMemo(() => {
    return (boards || [])
      .filter((board) => !board?.deleted_at)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [boards]);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="board_id">Board ID</Label>
        <Select
          value={config.board_id ? String(config.board_id) : ''}
          onValueChange={(value) => {
            if (!value) {
              onChange({ ...config, board_id: undefined });
              return;
            }
            onChange({ ...config, board_id: Number(value) });
          }}
        >
          <SelectTrigger id="board_id">
            <SelectValue placeholder="Select board" />
          </SelectTrigger>
          <SelectContent>
            {sortedBoards.length === 0 ? (
              <div className="px-2 py-1 text-sm text-muted-foreground">
                No boards found
              </div>
            ) : (
              sortedBoards.map((board) => (
                <SelectItem key={board.id} value={String(board.id)}>
                  {board.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground mt-1">
          The board to post the message to
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
