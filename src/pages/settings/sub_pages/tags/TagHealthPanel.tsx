import { useMemo } from "react";
import type { Tag } from "@/store/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TagHealthPanelProps {
	tags: Tag[];
	onEditTag: (tag: Tag) => void;
	onDeleteTag: (tag: Tag) => void;
}

const DAYS_STALE = 45;

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const getAgeInDays = (value?: string | Date) => {
	if (!value) return 0;
	const now = Date.now();
	const date = new Date(value).getTime();
	return Math.round((now - date) / (1000 * 60 * 60 * 24));
};

export default function TagHealthPanel({ tags, onEditTag, onDeleteTag }: TagHealthPanelProps) {
	const orphanedTags = useMemo(() => tags.filter((tag) => !tag.category_id), [tags]);

	const staleTags = useMemo(() => tags.filter((tag) => getAgeInDays(tag.updated_at ?? tag.created_at) > DAYS_STALE), [tags]);

	const duplicateGroups = useMemo(() => {
		const map = new Map<string, Tag[]>();
		tags.forEach((tag) => {
			const key = normalize(tag.name);
			const group = map.get(key) ?? [];
			group.push(tag);
			map.set(key, group);
		});
		return Array.from(map.values()).filter((group) => group.length > 1);
	}, [tags]);

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Governance spotlight</CardTitle>
					<CardDescription>Detect issues that bloated taxonomies introduce.</CardDescription>
				</CardHeader>
				<CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<HealthStat title="Orphaned tags" value={orphanedTags.length} description="Global tags without a steward" />
					<HealthStat title="Stale tags" value={staleTags.length} description={`No updates in ${DAYS_STALE}+ days`} />
					<HealthStat title="Duplicate families" value={duplicateGroups.length} description="Similar names detected" />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Orphaned tags</CardTitle>
					<CardDescription>Assign a category or convert to template-specific metadata.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{orphanedTags.slice(0, 10).map((tag) => (
						<div key={tag.id} className="flex items-center justify-between rounded border p-3 text-sm">
							<div>
								<p className="font-medium">{tag.name}</p>
								<p className="text-xs text-muted-foreground">Created {new Date(tag.created_at ?? Date.now()).toLocaleDateString()}</p>
							</div>
							<div className="flex gap-2">
								<Button size="sm" variant="outline" onClick={() => onEditTag(tag)}>
									Reassign
								</Button>
								<Button size="sm" variant="ghost" onClick={() => onDeleteTag(tag)}>
									Delete
								</Button>
							</div>
						</div>
					))}
					{!orphanedTags.length && <p className="text-sm text-muted-foreground">All tags are scoped — great!</p>}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Stale tags</CardTitle>
					<CardDescription>Review infrequently used labels to keep the board lean.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{staleTags.slice(0, 10).map((tag) => (
						<div key={tag.id} className="flex items-center justify-between rounded border p-3 text-sm">
							<div>
								<p className="font-medium">{tag.name}</p>
								<p className="text-xs text-muted-foreground">
									Last touched {getAgeInDays(tag.updated_at ?? tag.created_at)} days ago
								</p>
							</div>
							<div className="flex gap-2">
								<Button size="sm" variant="outline" onClick={() => onEditTag(tag)}>
									Refresh
								</Button>
								<Button size="sm" variant="ghost" onClick={() => onDeleteTag(tag)}>
									Archive
								</Button>
							</div>
						</div>
					))}
					{!staleTags.length && <p className="text-sm text-muted-foreground">No stale tags detected.</p>}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Duplicates & merge candidates</CardTitle>
					<CardDescription>Unify similar names to simplify filtering downstream.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{duplicateGroups.map((group, index) => (
						<div key={index} className="rounded border p-3">
							<p className="text-xs uppercase font-semibold text-muted-foreground">Variant {index + 1}</p>
							<div className="flex flex-wrap gap-2 mt-2">
								{group.map((tag) => (
									<Button key={tag.id} variant="outline" size="sm" onClick={() => onEditTag(tag)}>
										{tag.name}
									</Button>
								))}
							</div>
						</div>
					))}
					{!duplicateGroups.length && <p className="text-sm text-muted-foreground">No duplicate clusters for now.</p>}
				</CardContent>
			</Card>
		</div>
	);
}

function HealthStat({ title, value, description }: { title: string; value: number; description: string }) {
	return (
		<div>
			<p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
			<p className="text-3xl font-semibold mt-1">{value}</p>
			<p className="text-xs text-muted-foreground mt-1">{description}</p>
		</div>
	);
}







