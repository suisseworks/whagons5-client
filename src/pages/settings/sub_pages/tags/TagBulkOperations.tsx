import { useMemo, useState } from "react";
import type { Category, Tag } from "@/store/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TagBulkOperationsProps {
	tags: Tag[];
	categories: Category[];
	onBulkUpdate: (ids: number[], updates: Partial<Tag>) => Promise<void>;
}

export default function TagBulkOperations({ tags, categories, onBulkUpdate }: TagBulkOperationsProps) {
	const [selected, setSelected] = useState<number[]>([]);
	const [bulkColor, setBulkColor] = useState<string>("#6366f1");
	const [bulkCategory, setBulkCategory] = useState<string>("keep");

	const allSelected = useMemo(() => selected.length === tags.length && tags.length > 0, [selected.length, tags.length]);

	const toggleTag = (id: number, checked: boolean) => {
		setSelected((prev) => {
			if (checked) return Array.from(new Set([...prev, id]));
			return prev.filter((item) => item !== id);
		});
	};

	const toggleAll = (checked: boolean) => {
		if (checked) {
			setSelected(tags.map((tag) => tag.id));
		} else {
			setSelected([]);
		}
	};

	const handleApplyColor = async () => {
		if (!selected.length) return;
		await onBulkUpdate(selected, { color: bulkColor });
	};

	const handleAssignCategory = async () => {
		if (!selected.length || bulkCategory === "keep") return;
		await onBulkUpdate(selected, { category_id: bulkCategory === "global" ? null : Number(bulkCategory) });
	};

	const handleExport = async () => {
		const payload = tags.filter((tag) => selected.includes(tag.id));
		try {
			await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
		} catch {
			// ignore clipboard errors
		}
	};

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Bulk actions</CardTitle>
					<CardDescription>Select rows across the grid or from this list to run playbooks.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex items-center gap-2">
						<Checkbox id="select-all" checked={allSelected} onCheckedChange={(value) => toggleAll(Boolean(value))} />
						<label htmlFor="select-all" className="text-sm">
							Select all ({tags.length})
						</label>
					</div>
					<div className="max-h-64 overflow-auto rounded border divide-y">
						{tags.map((tag) => (
							<label key={tag.id} className="flex items-center gap-2 p-2 text-sm">
								<Checkbox checked={selected.includes(tag.id)} onCheckedChange={(value) => toggleTag(tag.id, Boolean(value))} />
								<span className="font-medium">{tag.name}</span>
								<span className="text-xs text-muted-foreground">{tag.category_id ? categories.find((category) => category.id === tag.category_id)?.name : "Global"}</span>
							</label>
						))}
						{!tags.length && <p className="text-sm text-muted-foreground p-2">No tags yet.</p>}
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Playbooks</CardTitle>
					<CardDescription>Apply colors, reassign scope, or export selection.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
						<div>
							<p className="text-xs uppercase text-muted-foreground">Color</p>
							<Input type="color" className="w-16 h-10" value={bulkColor} onChange={(event) => setBulkColor(event.target.value)} />
						</div>
						<Button onClick={handleApplyColor} disabled={!selected.length}>
							Apply color to {selected.length || ""} tags
						</Button>
					</div>
					<div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
						<div className="flex flex-col gap-1">
							<p className="text-xs uppercase text-muted-foreground">Category</p>
							<Select value={bulkCategory} onValueChange={setBulkCategory}>
								<SelectTrigger className="w-56">
									<SelectValue placeholder="Keep existing" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="keep">Keep existing</SelectItem>
									<SelectItem value="global">Global</SelectItem>
									{categories.map((category) => (
										<SelectItem key={category.id} value={category.id.toString()}>
											{category.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<Button onClick={handleAssignCategory} disabled={!selected.length || bulkCategory === "keep"}>
							Move selection
						</Button>
					</div>
					<Button variant="outline" onClick={handleExport} disabled={!selected.length}>
						Copy selection as JSON
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}





