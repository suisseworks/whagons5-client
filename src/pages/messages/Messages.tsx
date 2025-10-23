import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { genericActions } from '@/store/genericSlices';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useMatch, useNavigate } from 'react-router-dom';
import CreateMessageDialog from './CreateMessageDialog';
import { messageBoardsService } from './messageBoards';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check } from 'lucide-react';

const Messages: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { user } = useAuth();
    const messagesState = useSelector((s: RootState) => (s as any).messages);
    const users = useSelector((s: RootState) => (s as any).users?.value || []);
    const teams = useSelector((s: RootState) => (s as any).teams?.value || []);
    const match = useMatch('/messages/board/:id');
    const boardId = (match && (match.params as any)?.id) as string | undefined;
    // const workspaces = useSelector((s: RootState) => (s as any).workspaces?.value || []);

    const canCreate = !!user; // loosen for testing

    // Creation handled by dialog (FAB)
    const [createOpen, setCreateOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<'posts'|'settings'>('posts');
    const [deleteOpen, setDeleteOpen] = useState(false);
    const navigate = useNavigate();

	// Background images for board header (reuse style from Home)
	const backgroundImages = useMemo(() => [
		'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80',
		'https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=1920&q=80',
		'https://images.unsplash.com/photo-1522199710521-72d69614c702?auto=format&fit=crop&w=1920&q=80',
		'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1920&q=80',
	], []);
	const board = useMemo(() => (boardId ? messageBoardsService.get(boardId) : undefined), [boardId]);
	const [boardName, setBoardName] = useState<string>((board as any)?.name || '');
	const [boardDesc, setBoardDesc] = useState<string>((board as any)?.description || '');
    const [savedName, setSavedName] = useState(false);
    const [savedDesc, setSavedDesc] = useState(false);
	useEffect(() => {
		setBoardName((messageBoardsService.get(boardId || '') as any)?.name || '');
		setBoardDesc((messageBoardsService.get(boardId || '') as any)?.description || '');
	}, [boardId]);
	const bgIndex = useMemo(() => {
		if (!boardId) return 0;
		let sum = 0; for (let i = 0; i < boardId.length; i++) sum = (sum + boardId.charCodeAt(i)) >>> 0;
		return backgroundImages.length ? sum % backgroundImages.length : 0;
	}, [boardId, backgroundImages.length]);
	const headerUrl = backgroundImages[bgIndex];

	// Subtle background pattern for message cards (light/dark aware)
	const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
	const messagePatternStyle = useMemo(() => {
		const dot = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.18)';
		const faint = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
		return {
			backgroundImage: `radial-gradient(${dot} 1.6px, transparent 1.6px), radial-gradient(${faint} 1px, transparent 1px)`,
			backgroundSize: '18px 18px, 18px 18px',
			backgroundPosition: '0 0, 9px 9px',
		} as React.CSSProperties;
	}, [isDark]);

	// simple local settings (demo)
	const [settingsUsers, setSettingsUsers] = useState<number[]>([]);
	const [settingsTeams, setSettingsTeams] = useState<number[]>([]);
	const [userSearch, setUserSearch] = useState('');
	const [teamSearch, setTeamSearch] = useState('');
	const settingsKey = 'wh-messages-board-settings';

	useEffect(() => {
		dispatch((genericActions as any).messages.getFromIndexedDB());
		dispatch((genericActions as any).messages.fetchFromAPI());
		// preload users/teams for settings
		try {
			dispatch((genericActions as any).users.getFromIndexedDB());
			dispatch((genericActions as any).users.fetchFromAPI());
			dispatch((genericActions as any).teams.getFromIndexedDB());
			dispatch((genericActions as any).teams.fetchFromAPI());
		} catch {}
		// load saved settings (per board if present)
		try {
			if (boardId) {
				const board = messageBoardsService.get(boardId);
				setSettingsUsers(Array.isArray(board?.user_ids) ? (board as any).user_ids : []);
				setSettingsTeams(Array.isArray(board?.team_ids) ? (board as any).team_ids : []);
			} else {
				const raw = localStorage.getItem(settingsKey);
				if (raw) {
					const parsed = JSON.parse(raw);
					setSettingsUsers(Array.isArray(parsed?.users) ? parsed.users : []);
					setSettingsTeams(Array.isArray(parsed?.teams) ? parsed.teams : []);
				}
			}
		} catch {}
	}, [dispatch, boardId]);

	const saveSettings = () => {
		if (boardId) {
			messageBoardsService.update(boardId, { user_ids: settingsUsers, team_ids: settingsTeams });
		} else {
			localStorage.setItem(settingsKey, JSON.stringify({ users: settingsUsers, teams: settingsTeams }));
		}
	};

    const sortedMessages = useMemo(() => {
        const rows = (messagesState?.value || []) as any[];
        return [...rows].sort((a, b) => {
            const ap = a.is_pinned ? 1 : 0;
            const bp = b.is_pinned ? 1 : 0;
            if (ap !== bp) return bp - ap; // pinned first
            return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
        });
    }, [messagesState?.value]);

    const handleAdd = async (data?: { title?: string; content?: string; pinned?: boolean }) => {
        const body = (data?.content || '').trim();
        if (!body) return;
        const payload = {
            title: (data?.title || '').trim() || null,
            content: body,
            workspace_id: null,
            team_id: null,
            spot_id: null,
            created_by: (user as any)?.id ? Number((user as any).id) : undefined,
            starts_at: null,
            ends_at: null,
            is_pinned: !!data?.pinned,
        } as any;
        await dispatch((genericActions as any).messages.addAsync(payload));
    };

    return (
		<div className="p-4">
            <h1 className="text-2xl font-semibold mb-2">Messages</h1>
            <p className="text-muted-foreground mb-4">Communication boards for your workspace.</p>

			{boardId && (
				<div
					className="relative w-full h-40 rounded-lg overflow-hidden mb-4"
					style={{ backgroundImage: `url(${headerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
				>
					<div className="absolute inset-0 bg-gradient-to-r from-black/40 to-black/10" />
					<div className="relative z-10 p-4">
						<div className="text-sm text-white/80">Message Board</div>
						<input
							className="text-2xl font-semibold text-white bg-transparent border-b border-white/30 focus:outline-none focus:border-white w-full max-w-xl"
							value={boardName}
							onChange={(e) => setBoardName(e.target.value)}
							onBlur={() => { if (boardId) { messageBoardsService.update(boardId, { name: boardName || 'Untitled' }); try { window.dispatchEvent(new Event('wh-boards-updated')); } catch {} setSavedName(true); setTimeout(() => setSavedName(false), 1200); } }}
							placeholder="Board name"
						/>
						<textarea
							className="mt-1 text-white/90 bg-transparent border-b border-white/20 focus:outline-none focus:border-white/40 w-full max-w-xl resize-none"
							rows={2}
							value={boardDesc}
							onChange={(e) => setBoardDesc(e.target.value)}
							onBlur={() => { if (boardId) { messageBoardsService.update(boardId, { description: boardDesc }); setSavedDesc(true); setTimeout(() => setSavedDesc(false), 1200); } }}
							placeholder="Add a short description..."
						/>
						{(savedName || savedDesc) && (
							<div className="mt-2 flex justify-end">
								<span className="inline-flex items-center text-xs text-white bg-black/40 px-2 py-0.5 rounded">
									<Check size={12} className="mr-1" />
									Saved
								</span>
							</div>
						)}
					</div>
				</div>
			)}

			<div className="mb-4 flex items-center gap-2">
				<Button variant={activeTab === 'posts' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveTab('posts')}>Posts</Button>
				<Button variant={activeTab === 'settings' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveTab('settings')}>Settings</Button>
			</div>

			{activeTab === 'posts' && (
				<>
					<div className="space-y-3">
						{sortedMessages.map((m: any) => (
							<Card key={m.id} className="p-4" style={messagePatternStyle}>
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
				</>
			)}

			{activeTab === 'settings' && (
				<Card className="p-4">
					<h2 className="text-lg font-medium mb-3">Board Settings</h2>
					{!boardId && (
						<p className="text-sm text-muted-foreground mb-3">Open a specific board to configure its members. Showing demo settings.</p>
					)}
					<div className="grid md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Invite Users</Label>
							<Input className="h-9" placeholder="Search users" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                            <div className="max-h-48 overflow-auto border rounded p-2">
                                {(users as any[])
                                    .filter((u: any) => !userSearch.trim() || (u.name || u.email || '').toLowerCase().includes(userSearch.toLowerCase()))
                                    .map((u: any) => {
										const checked = settingsUsers.includes(u.id);
										return (
											<label key={u.id} className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-accent/50 cursor-pointer">
												<span className="text-sm">{u.name || u.email || `User ${u.id}`}</span>
												<input type="checkbox" className="accent-primary" checked={checked} onChange={(e) => setSettingsUsers((prev) => e.target.checked ? Array.from(new Set([...prev, u.id])) : prev.filter((id) => id !== u.id))} />
											</label>
										);
									})}
                                {Array.isArray(users) && users.length === 0 && (
                                    <div className="text-xs text-muted-foreground">No users found.</div>
                                )}
							</div>
						</div>
						<div className="space-y-2">
							<Label>Invite Teams</Label>
							<Input className="h-9" placeholder="Search teams" value={teamSearch} onChange={(e) => setTeamSearch(e.target.value)} />
                            <div className="max-h-48 overflow-auto border rounded p-2">
                                {(teams as any[])
                                    .filter((t: any) => !teamSearch.trim() || (t.name || '').toLowerCase().includes(teamSearch.toLowerCase()))
                                    .map((t: any) => {
										const checked = settingsTeams.includes(t.id);
										return (
											<label key={t.id} className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-accent/50 cursor-pointer">
												<span className="text-sm">{t.name || `Team ${t.id}`}</span>
												<input type="checkbox" className="accent-primary" checked={checked} onChange={(e) => setSettingsTeams((prev) => e.target.checked ? Array.from(new Set([...prev, t.id])) : prev.filter((id) => id !== t.id))} />
											</label>
										);
									})}
                                {Array.isArray(teams) && teams.length === 0 && (
                                    <div className="text-xs text-muted-foreground">No teams found.</div>
                                )}
							</div>
						</div>
						<div className="md:col-span-2 flex items-center justify-between gap-2">
							{boardId ? (
								<Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete Board</Button>
							) : <span />}
							<Button variant="outline" onClick={saveSettings}>Save</Button>
						</div>
					</div>
				</Card>
			)}


		{/* Floating create message button */}
        {canCreate && (
            <button className="fixed right-6 bottom-8 inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl" onClick={() => setCreateOpen(true)} aria-label="Create Message">+</button>
        )}
        <CreateMessageDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={(p) => handleAdd(p)} />

        {/* Delete board dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete message board?</DialogTitle>
                    <DialogDescription>
                        This action cannot be undone. The board will be removed from the sidebar.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={() => {
                        if (!boardId) { setDeleteOpen(false); return; }
                        try { messageBoardsService.remove(boardId); } catch {}
                        try { window.dispatchEvent(new Event('wh-boards-updated')); } catch {}
                        setDeleteOpen(false);
                        navigate('/messages');
                    }}>Delete</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </div>
    );
};

export default Messages;
