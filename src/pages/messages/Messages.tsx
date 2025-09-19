import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { genericActions } from '@/store/genericSlices';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

const Messages: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { user } = useAuth();
    const messagesState = useSelector((s: RootState) => (s as any).messages);
    const workspaces = useSelector((s: RootState) => (s as any).workspaces?.value || []);

    const canCreate = !!user?.is_admin; // TODO: replace with fine-grained permission when available

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [workspaceId, setWorkspaceId] = useState<number | ''>('' as any);
    const [isPinned, setIsPinned] = useState(false);

    useEffect(() => {
        dispatch((genericActions as any).messages.getFromIndexedDB());
        dispatch((genericActions as any).messages.fetchFromAPI());
    }, [dispatch]);

    const sortedMessages = useMemo(() => {
        const rows = (messagesState?.value || []) as any[];
        return [...rows].sort((a, b) => {
            const ap = a.is_pinned ? 1 : 0;
            const bp = b.is_pinned ? 1 : 0;
            if (ap !== bp) return bp - ap; // pinned first
            return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
        });
    }, [messagesState?.value]);

    const resetForm = () => {
        setTitle('');
        setContent('');
        setWorkspaceId('' as any);
        setIsPinned(false);
    };

    const handleAdd = async () => {
        if (!content.trim() || !workspaceId) return;
        const payload = {
            title: title?.trim() || null,
            content: content.trim(),
            workspace_id: Number(workspaceId),
            team_id: null,
            spot_id: null,
            created_by: (user as any)?.id ? Number((user as any).id) : undefined,
            starts_at: null,
            ends_at: null,
            is_pinned: !!isPinned,
        } as any;
        await dispatch((genericActions as any).messages.addAsync(payload));
        resetForm();
    };

    return (
        <div className="p-4">
            <h1 className="text-2xl font-semibold mb-2">Messages</h1>
            <p className="text-muted-foreground mb-4">Communication boards for your workspace.</p>

            {canCreate && (
                <Card className="p-4 mb-6">
                    <h2 className="text-lg font-medium mb-3">Add Message</h2>
                    <div className="grid gap-3">
                        <div>
                            <Label htmlFor="workspace">Workspace</Label>
                            <select
                                id="workspace"
                                value={workspaceId as any}
                                onChange={(e) => setWorkspaceId(e.target.value ? Number(e.target.value) : ('' as any))}
                                className="mt-1 w-full bg-background border rounded px-3 py-2"
                            >
                                <option value="">Select a workspace</option>
                                {workspaces.map((w: any) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="title">Title</Label>
                            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional title" />
                        </div>
                        <div>
                            <Label htmlFor="content">Content</Label>
                            <textarea
                                id="content"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Write your announcement or message..."
                                rows={4}
                                className="mt-1 w-full bg-background border rounded px-3 py-2"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input id="pinned" type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="rounded" />
                            <Label htmlFor="pinned">Pin this message</Label>
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={handleAdd} disabled={!workspaceId || !content.trim()}>
                                Post Message
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            <div className="space-y-3">
                {sortedMessages.map((m: any) => (
                    <Card key={m.id} className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="text-base font-medium">{m.title || 'Untitled'}</div>
                            {m.is_pinned ? <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">Pinned</span> : null}
                        </div>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-2">{m.content}</div>
                        <div className="text-xs text-muted-foreground mt-2">Updated {new Date(m.updated_at || m.created_at).toLocaleString()}</div>
                    </Card>
                ))}
                {sortedMessages.length === 0 && (
                    <div className="text-sm text-muted-foreground">No messages yet.</div>
                )}
            </div>
        </div>
    );
};

export default Messages;
