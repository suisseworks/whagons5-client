import { useMemo } from "react";
import type { Category, Tag } from "@/store/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TagSuggestionsPanelProps {
	tags: Tag[];
	categories: Category[];
	onCreateTag: (data: Pick<Tag, "name" | "color" | "icon" | "category_id">) => Promise<void>;
	onUpdateTag: (id: number, data: Partial<Tag>) => Promise<void>;
}

interface Suggestion {
	id: string;
	title: string;
	description: string;
	actionLabel: string;
	action: () => Promise<void>;
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

export default function TagSuggestionsPanel({ tags, categories, onCreateTag, onUpdateTag }: TagSuggestionsPanelProps) {
	const suggestions = useMemo<Suggestion[]>(() => {
		const list: Suggestion[] = [];

		// Merge duplicates
		const map = new Map<string, Tag[]>();
		tags.forEach((tag) => {
			const key = normalize(tag.name);
			const group = map.get(key) ?? [];
			group.push(tag);
			map.set(key, group);
		});
		map.forEach((group, key) => {
			if (group.length > 1) {
				const keeper = group[0];
				const duplicate = group[1];
				list.push({
					id: `merge-${key}`,
					title: `Merge “${duplicate.name}” into “${keeper.name}”`,
					description: "Detected similar names; align them now so filters stay clean.",
					actionLabel: "Align",
					action: () =>
						onUpdateTag(duplicate.id, {
							name: `${keeper.name} (${duplicate.id})`,
							color: keeper.color,
							category_id: keeper.category_id ?? duplicate.category_id ?? null
						})
				});
			}
		});

		// Category with no tags
		categories
			.filter((category) => !tags.some((tag) => Number(tag.category_id) === category.id))
			.slice(0, 3)
			.forEach((category) => {
				list.push({
					id: `gap-${category.id}`,
					title: `Seed category “${category.name}”`,
					description: "No tags found for this category. Add a starter label so tasks are discoverable.",
					actionLabel: "Create tag",
					action: () =>
						onCreateTag({
							name: `${category.name} Ready`,
							color: category.color || "#0ea5e9",
							icon: "fas fa-tag",
							category_id: category.id
						})
				});
			});

		// Color clash suggestions
		const colorGroups = new Map<string, Tag[]>();
		tags.forEach((tag) => {
			const key = `${tag.category_id || "global"}-${tag.color || "none"}`;
			const group = colorGroups.get(key) ?? [];
			group.push(tag);
			colorGroups.set(key, group);
		});
		colorGroups.forEach((group, key) => {
			if (group.length > 3) {
				const target = group[0];
				list.push({
					id: `color-${key}`,
					title: `Soften color overload in ${target.category_id ? categories.find((c) => c.id === target.category_id)?.name : "Global"}`,
					description: "Many tags share the same hue. Consider shifting tone for better scanning.",
					actionLabel: "Recolor latest tag",
					action: () =>
						onUpdateTag(group[group.length - 1].id, {
							color: randomColor()
						})
				});
			}
		});

		return list;
	}, [tags, categories, onCreateTag, onUpdateTag]);

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">AI-ish heuristics (client-side)</CardTitle>
					<CardDescription>These run entirely in the browser — no backend calls yet.</CardDescription>
				</CardHeader>
			</Card>
			{suggestions.map((suggestion) => (
				<Card key={suggestion.id}>
					<CardHeader>
						<CardTitle className="text-sm">{suggestion.title}</CardTitle>
						<CardDescription>{suggestion.description}</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={suggestion.action}>{suggestion.actionLabel}</Button>
					</CardContent>
				</Card>
			))}
			{!suggestions.length && <p className="text-sm text-muted-foreground">No suggestions right now. Add more tags to unlock ideas.</p>}
		</div>
	);
}

const randomColor = () => {
	const palette = ["#10b981", "#ec4899", "#3b82f6", "#f97316", "#a855f7", "#14b8a6"];
	return palette[Math.floor(Math.random() * palette.length)];
};







