import { useEffect, useMemo, useState } from "react";
import type { Tag } from "@/store/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

interface TagCommandCenterProps {
	tags: Tag[];
	onTriggerCreate: () => void;
	onEditTag: (tag: Tag) => void;
	onSearch: (query: string) => void;
	inlineEditingEnabled: boolean;
	onToggleInlineEditing: (enabled: boolean) => void;
}

export default function TagCommandCenter({
	tags,
	onTriggerCreate,
	onEditTag,
	onSearch,
	inlineEditingEnabled,
	onToggleInlineEditing
}: TagCommandCenterProps) {
	const [open, setOpen] = useState(false);
	const [commandQuery, setCommandQuery] = useState("");

	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				setOpen((value) => !value);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	const quickActions = useMemo(
		() => [
			{
				label: "Create tag",
				hint: "Open dialog",
				action: () => {
					onTriggerCreate();
					setOpen(false);
				}
			},
			{
				label: inlineEditingEnabled ? "Disable inline editing" : "Enable inline editing",
				hint: "Grid mode",
				action: () => {
					onToggleInlineEditing(!inlineEditingEnabled);
					setOpen(false);
				}
			}
		],
		[inlineEditingEnabled, onToggleInlineEditing, onTriggerCreate]
	);

	const tagItems = useMemo(
		() =>
			tags.slice(0, 15).map((tag) => ({
				id: tag.id,
				label: `Edit ${tag.name}`,
				action: () => {
					onEditTag(tag);
					setOpen(false);
				}
			})),
		[tags, onEditTag]
	);

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<CardTitle className="text-base">Command center</CardTitle>
						<CardDescription>Hit ⌘K / Ctrl+K anywhere on this page to jump to actions.</CardDescription>
					</div>
					<Button variant="outline" onClick={() => setOpen(true)}>
						Open palette
					</Button>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-sm text-muted-foreground">
						Use the palette to create tags, filter the grid, or jump straight into editing a specific tag. Inline editing is powered by AG Grid’s editors
						and toggled from the palette too.
					</p>
					<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
						<Badge variant="outline">⌘K / Ctrl+K</Badge>
						<Badge variant="outline">Search tags</Badge>
						<Badge variant="outline">Toggle inline editing</Badge>
						<Badge variant="outline">Create tag</Badge>
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Inline editing primer</CardTitle>
					<CardDescription>With inline editing enabled, single-click a cell in the Manage tab to edit instantly.</CardDescription>
				</CardHeader>
				<CardContent className="text-sm text-muted-foreground">
					<p>Use the palette to toggle inline editing. When it’s on:</p>
					<ul className="list-disc ml-5 mt-2 space-y-1">
						<li>Single-click fields to edit name/color directly.</li>
						<li>Press Enter to save, Esc to revert, or Tab to move to the next cell.</li>
						<li>
							Try running <span className="font-mono">“Search urgent”</span> in the palette to filter the grid via quick filter.
						</li>
					</ul>
				</CardContent>
			</Card>

			<CommandDialog
				open={open}
				onOpenChange={(value) => {
					setOpen(value);
					if (!value) setCommandQuery("");
				}}
			>
				<Command>
					<CommandInput placeholder="Type a command or search tags..." value={commandQuery} onValueChange={setCommandQuery} />
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
						<CommandGroup heading="Actions">
							{quickActions.map((action) => (
								<CommandItem key={action.label} value={action.label.toLowerCase()} onSelect={action.action}>
									{action.label}
									<span className="ml-auto text-xs text-muted-foreground">{action.hint}</span>
								</CommandItem>
							))}
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Tags">
							{tagItems.map((item) => (
								<CommandItem key={item.id} value={item.label.toLowerCase()} onSelect={item.action}>
									{item.label}
								</CommandItem>
							))}
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Search">
							<CommandItem
								value="Search"
								onSelect={(value) => {
									onSearch(commandQuery);
									setOpen(false);
								}}
							>
								Search “{commandQuery || "..."}”
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
			</CommandDialog>
		</div>
	);
}
