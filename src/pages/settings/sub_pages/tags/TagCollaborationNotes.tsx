import { useMemo, useState } from "react";
import type { Tag } from "@/store/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { readSettingsLocal, updateSettingsLocal } from "@/lib/settingsLocalStore";
import { nanoid } from "nanoid";

interface TagCollaborationNotesProps {
	tags: Tag[];
}

interface TagNote {
	id: string;
	tagId: number;
	author: string;
	message: string;
	createdAt: string;
}

const STORAGE_KEY = "settings:tag-notes";

export default function TagCollaborationNotes({ tags }: TagCollaborationNotesProps) {
	const [selectedTagId, setSelectedTagId] = useState<string>("0");
	const [author, setAuthor] = useState<string>("");
	const [message, setMessage] = useState<string>("");
	const [notes, setNotes] = useState<TagNote[]>(() => readSettingsLocal<TagNote[]>(STORAGE_KEY, []));
	const selectedNotes = useMemo(() => {
		const tagIdNumber = Number(selectedTagId);
		return notes.filter((note) => (tagIdNumber ? note.tagId === tagIdNumber : true)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	}, [notes, selectedTagId]);

	const handleAddNote = () => {
		if (!message.trim()) return;
		const tagIdNumber = Number(selectedTagId);
		if (!tagIdNumber) return;
		const nextNote: TagNote = {
			id: nanoid(),
			tagId: tagIdNumber,
			author: author || "Anon",
			message: message.trim(),
			createdAt: new Date().toISOString()
		};
		const updated = [...notes, nextNote];
		setNotes(updated);
		updateSettingsLocal<TagNote[]>(STORAGE_KEY, () => updated, updated);
		setMessage("");
	};

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="flex flex-col gap-4">
					<div>
						<CardTitle className="text-base">Collaboration threads</CardTitle>
						<CardDescription>Lightweight notes persisted locally while we wait for backend comments.</CardDescription>
					</div>
					<div className="flex flex-col gap-2 md:flex-row md:items-center">
						<Select value={selectedTagId} onValueChange={setSelectedTagId}>
							<SelectTrigger className="w-64">
								<SelectValue placeholder="Select tag" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="0">All tags</SelectItem>
								{tags.map((tag) => (
									<SelectItem key={tag.id} value={tag.id.toString()}>
										{tag.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Input placeholder="Your name (optional)" value={author} onChange={(event) => setAuthor(event.target.value)} className="md:w-48" />
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					<Textarea
						placeholder="Capture context, ownership decisions, or governance reminders..."
						value={message}
						onChange={(event) => setMessage(event.target.value)}
						rows={4}
					/>
					<Button onClick={handleAddNote} disabled={!message.trim() || selectedTagId === "0"}>
						Add note
					</Button>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Latest notes</CardTitle>
					<CardDescription>Notes stay in your browser only, making this safe for experimentation.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{selectedNotes.map((note) => {
						const tag = tags.find((t) => t.id === note.tagId);
						return (
							<div key={note.id} className="flex gap-3 rounded border p-3">
								<Avatar className="h-10 w-10">
									<AvatarFallback>{getInitials(note.author)}</AvatarFallback>
								</Avatar>
								<div>
									<div className="flex items-center gap-2 text-sm font-medium">
										<span>{note.author}</span>
										<span className="text-xs text-muted-foreground">on {tag?.name ?? "Unknown"}</span>
										<span className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</span>
									</div>
									<p className="text-sm text-muted-foreground mt-1">{note.message}</p>
								</div>
							</div>
						);
					})}
					{!selectedNotes.length && <p className="text-sm text-muted-foreground">No notes yet for this view.</p>}
				</CardContent>
			</Card>
		</div>
	);
}

const getInitials = (name: string) => {
	if (!name) return "??";
	const parts = name.trim().split(" ");
	if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "U";
	return `${parts[0][0]?.toUpperCase() ?? ""}${parts[1][0]?.toUpperCase() ?? ""}`;
};





