import { useMemo, useState, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import type { Category, Tag } from "@/store/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface TagRelationshipMapProps {
	tags: Tag[];
	categories: Category[];
	onEditTag: (tag: Tag) => void;
}

interface GraphNode {
	id: string;
	name: string;
	value: number;
	category: number;
	type: "category" | "tag";
	symbolSize: number;
	itemStyle: { color: string };
	tagRef?: Tag;
}

export default function TagRelationshipMap({ tags, categories, onEditTag }: TagRelationshipMapProps) {
	const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
	const [showGlobalOnly, setShowGlobalOnly] = useState<boolean>(false);

	const filteredTags = useMemo(() => {
		return tags.filter((tag) => {
			if (showGlobalOnly && tag.category_id) {
				return false;
			}
			if (selectedCategoryId === "all") {
				return true;
			}
			if (selectedCategoryId === "global") {
				return !tag.category_id;
			}
			return Number(tag.category_id) === Number(selectedCategoryId);
		});
	}, [tags, selectedCategoryId, showGlobalOnly]);

	const graphData = useMemo(() => {
		const baseNodes: GraphNode[] = [];
		const links: Array<{ source: string; target: string; value: number }> = [];

		const visibleCategories =
			selectedCategoryId === "all"
				? categories
				: categories.filter((category) => category.id === Number(selectedCategoryId));

		visibleCategories.forEach((category, index) => {
			baseNodes.push({
				id: `category-${category.id}`,
				name: category.name,
				value: 10 + index,
				category: index,
				type: "category",
				symbolSize: 60,
				itemStyle: {
					color: category.color || "#6366f1"
				}
			});
		});

		if (selectedCategoryId === "all") {
			baseNodes.push({
				id: "category-global",
				name: "Global",
				value: 12,
				category: visibleCategories.length,
				type: "category",
				symbolSize: 70,
				itemStyle: {
					color: "#0ea5e9"
				}
			});
		}

		filteredTags.forEach((tag, index) => {
			const categoryKey = tag.category_id ? `category-${tag.category_id}` : "category-global";
			baseNodes.push({
				id: `tag-${tag.id}`,
				name: tag.name,
				value: 5 + index,
				category: baseNodes.findIndex((node) => node.id === categoryKey),
				type: "tag",
				symbolSize: 35,
				itemStyle: {
					color: tag.color || "#a855f7"
				},
				tagRef: tag
			});

			links.push({
				source: categoryKey,
				target: `tag-${tag.id}`,
				value: Math.round(Math.random() * 10) + 1
			});
		});

		return { nodes: baseNodes, links };
	}, [filteredTags, categories, selectedCategoryId]);

	const handleNodeClick = useCallback(
		(params: any) => {
			const node = params?.data as GraphNode | undefined;
			if (node?.type === "tag" && node.tagRef) {
				onEditTag(node.tagRef);
			}
		},
		[onEditTag]
	);

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="flex flex-col gap-4">
					<div className="flex flex-col gap-1">
						<CardTitle className="text-base">Relationship Map</CardTitle>
						<CardDescription>Visualize how tags relate to categories and scope.</CardDescription>
					</div>
					<div className="flex flex-wrap gap-3">
						<div className="flex flex-col gap-1 w-48">
							<Label>Scope</Label>
							<Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
								<SelectTrigger>
									<SelectValue placeholder="Select filter" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Categories</SelectItem>
									<SelectItem value="global">Global Tags</SelectItem>
									{categories.map((category) => (
										<SelectItem key={category.id} value={category.id.toString()}>
											{category.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center gap-2">
							<Switch id="global-only-toggle" checked={showGlobalOnly} onCheckedChange={setShowGlobalOnly} />
							<div className="space-y-1">
								<Label htmlFor="global-only-toggle" className="text-sm">
									Show Global Only
								</Label>
								<p className="text-xs text-muted-foreground">Highlights organization-wide tags.</p>
							</div>
						</div>
						<Button variant="outline" size="sm" onClick={() => setSelectedCategoryId("all")}>
							Reset Filters
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<ReactECharts
						option={{
							tooltip: {},
							series: [
								{
									type: "graph",
									layout: "force",
									roam: true,
									draggable: true,
									emphasis: { focus: "adjacency" },
									label: {
										show: true
									},
									force: {
										repulsion: 120,
										edgeLength: 80
									},
									data: graphData.nodes,
									links: graphData.links,
									lineStyle: {
										color: "source",
										width: 2,
										curveness: 0.15
									}
								}
							]
						}}
						onEvents={{ click: handleNodeClick }}
						style={{ height: 420 }}
					/>
				</CardContent>
			</Card>
		</div>
	);
}


