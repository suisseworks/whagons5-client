import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { messageBoardsService } from './messageBoards';

export default function CreateBoardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void; }) {
  const workspaces = useSelector((s: RootState) => (s as any).workspaces?.value || []);
  const [name, setName] = useState('');
  const [workspaceId, setWorkspaceId] = useState<number | ''>('' as any);

  const handleCreate = () => {
    if (!name.trim()) return;
    messageBoardsService.create({ name: name.trim(), workspace_id: workspaceId ? Number(workspaceId) : null });
    onOpenChange(false); setName(''); setWorkspaceId('' as any);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Message Board</DialogTitle>
          <DialogDescription>Enter details for your new board. Click save when you're done.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="e.g., Announcements" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="ws" className="text-right">Workspace</Label>
            <select id="ws" value={workspaceId as any} onChange={(e) => setWorkspaceId(e.target.value ? Number(e.target.value) : ('' as any))} className="col-span-3 w-full bg-background border rounded px-3 py-2">
              <option value="">All workspaces</option>
              {workspaces.map((w: any) => (<option key={w.id} value={w.id}>{w.name}</option>))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>Save Board</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


