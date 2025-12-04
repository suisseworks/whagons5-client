import { useMemo, useState } from "react";
import type { Category, Tag } from "@/store/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TAG_PRESET_COLLECTIONS, type TagPreset } from "@/data/tagPresets";
import { Badge } from "@/components/ui/badge";

interface TagPresetsLibraryProps {
	categories: Category[];
	onApplyPreset: (preset: TagPreset) => Promise<void>;
	onCreatePaletteTag: (tag: Pick<Tag, "name" | "color" | "icon" | "category_id">) => Promise<void>;
}

const COLOR_PALETTE = ["#0ea5e9", "#6366f1", "#a855f7", "#f97316", "#ef4444", "#22c55e", "#facc15"];
const ICONS = ["fas fa-tag", "fas fa-bolt", "fas fa-bullseye", "fas fa-feather", "fas fa-leaf", "fas fa-star"];

export default function TagPresetsLibrary({ categories, onApplyPreset, onCreatePaletteTag }: TagPresetsLibraryProps) {
	const [paletteName, setPaletteName] = useState<string>("");
	const [paletteCategory, setPaletteCategory] = useState<string>("global");
	const [isGenerating, setIsGenerating] = useState<boolean>(false);

	const paletteSuggestions = useMemo(() => {
		if (!paletteName.trim()) return [];
		const tokens = paletteName.split(",").map((token) => token.trim()).filter(Boolean);

		return tokens.map((token, index) => ({
			name: token,
			color: COLOR_PALETTE[index % COLOR_PALETTE.length],
			icon: ICONS[index % ICONS.length],
			category_id: paletteCategory === "global" ? null : Number(paletteCategory)
		}));
	}, [paletteName, paletteCategory]);

	const handleApplyPreset = async (preset: TagPreset) => {
		await onApplyPreset(preset);
	};

	const handleGeneratePalette = async () => {
		if (!paletteSuggestions.length) return;
		setIsGenerating(true);
		for (const suggestion of paletteSuggestions) {
			// eslint-disable-next-line no-await-in-loop
			await onCreatePaletteTag(suggestion);
		}
		setIsGenerating(false);
	};

	const exportPreset = async (preset: TagPreset) => {
		try {
			await navigator.clipboard.writeText(JSON.stringify(preset, null, 2));
		} catch {
			// ignore clipboard errors
		}
	};

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Preset collections</CardTitle>
					<CardDescription>Drop-in bundles curated from other customers’ boards.</CardDescription>
				</CardHeader>
				<CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{TAG_PRESET_COLLECTIONS.map((preset) => (
						<Card key={preset.id} className="border-dashed">
							<CardHeader>
								<CardTitle className="text-sm">{preset.name}</CardTitle>
								<CardDescription>{preset.description}</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex flex-wrap gap-2">
									{preset.tags.map((tag) => (
										<Badge key={tag.name} style={{ backgroundColor: `${tag.color}22`, color: tag.color }} variant="outline">
											{tag.name}
										</Badge>
									))}
								</div>
								<div className="flex gap-2">
									<Button size="sm" onClick={() => handleApplyPreset(preset)}>
										Clone bundle
									</Button>
									<Button size="sm" variant="outline" onClick={() => exportPreset(preset)}>
										Copy JSON
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Palette helper</CardTitle>
					<CardDescription>Type comma-separated names and auto-generate color/icon pairings.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Input placeholder="ex: Purple Room, Tech Debt, VIP Review" value={paletteName} onChange={(event) => setPaletteName(event.target.value)} />
					<div className="flex flex-col gap-2 md:flex-row md:items-center">
						<p className="text-sm font-medium">Scope</p>
						<Select value={paletteCategory} onValueChange={setPaletteCategory}>
							<SelectTrigger className="w-52">
								<SelectValue placeholder="Choose category" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="global">Global</SelectItem>
								{categories.map((category) => (
									<SelectItem key={category.id} value={category.id.toString()}>
										{category.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-wrap gap-3">
						{paletteSuggestions.map((suggestion) => (
							<div key={suggestion.name} className="rounded border p-3 w-48">
								<p className="font-medium">{suggestion.name}</p>
								<p className="text-xs text-muted-foreground">{suggestion.category_id ? categories.find((category) => category.id === suggestion.category_id)?.name : "Global"}</p>
								<div className="flex gap-2 mt-3">
									<span className="inline-flex h-6 w-6 rounded-full border" style={{ backgroundColor: suggestion.color }} />
									<span className="text-xs text-muted-foreground">{suggestion.icon}</span>
								</div>
							</div>
						))}
						{!paletteSuggestions.length && <p className="text-sm text-muted-foreground">Start typing names to preview combos.</p>}
					</div>
					<Button onClick={handleGeneratePalette} disabled={!paletteSuggestions.length || isGenerating}>
						{isGenerating ? "Generating..." : "Create tags"}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
