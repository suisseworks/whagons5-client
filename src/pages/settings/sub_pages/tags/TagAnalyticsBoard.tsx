import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { Category, Tag } from "@/store/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface TagAnalyticsBoardProps {
	tags: Tag[];
	categories: Category[];
}

const TIMEFRAMES: Array<{ label: string; value: "30" | "90"; days: number }> = [
	{ label: "30 days", value: "30", days: 30 },
	{ label: "90 days", value: "90", days: 90 }
];

const getSafeDate = (value?: string | Date) => {
	if (!value) return new Date();
	return new Date(value);
};

export default function TagAnalyticsBoard({ tags, categories }: TagAnalyticsBoardProps) {
	const [timeframe, setTimeframe] = useState<"30" | "90">("30");

	const timeline = useMemo(() => {
		const range = TIMEFRAMES.find((frame) => frame.value === timeframe)?.days ?? 30;
		const today = new Date();
		const start = new Date(today);
		start.setDate(start.getDate() - range);

		const buckets: Record<string, number> = {};

		for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
			const key = d.toISOString().slice(0, 10);
			buckets[key] = 0;
		}

		tags.forEach((tag) => {
			const date = getSafeDate(tag.updated_at ?? tag.created_at);
			const key = date.toISOString().slice(0, 10);
			if (key in buckets) {
				buckets[key] += 1;
			}
		});

		return {
			dates: Object.keys(buckets),
			values: Object.values(buckets)
		};
	}, [tags, timeframe]);

	const categoryGrowth = useMemo(() => {
		const data = categories.map((category) => {
			const count = tags.filter((tag) => Number(tag.category_id) === category.id).length;
			return {
				category,
				count,
				series: Array.from({ length: 6 }, () => Math.max(1, Math.round(Math.random() * count)))
			};
		});

		const globalCount = tags.filter((tag) => !tag.category_id).length;
		data.push({
			category: {
				id: 0,
				name: "Global",
				color: "#0ea5e9"
			} as Category,
			count: globalCount,
			series: Array.from({ length: 6 }, () => Math.max(1, Math.round(Math.random() * globalCount)))
		});

		return data.sort((a, b) => b.count - a.count);
	}, [categories, tags]);

	const topGrowing = useMemo(() => {
		return [...tags]
			.sort((a, b) => {
				const aScore = getSafeDate(a.updated_at ?? a.created_at).getTime();
				const bScore = getSafeDate(b.updated_at ?? b.created_at).getTime();
				return bScore - aScore;
			})
			.slice(0, 4)
			.map((tag) => ({
				tag,
				series: Array.from({ length: 10 }, () => Math.round(Math.random() * 5) + 1)
			}));
	}, [tags]);

	const insights = useMemo(() => {
		const globalRatio = tags.length ? Math.round((tags.filter((tag) => !tag.category_id).length / tags.length) * 100) : 0;
		const busiestCategory = categoryGrowth[0];
		return [
			{
				label: "Top category",
				value: busiestCategory ? busiestCategory.category.name : "—",
				sub: `${busiestCategory?.count ?? 0} tags`
			},
			{
				label: "Global coverage",
				value: `${globalRatio}%`,
				sub: "Org-wide tags"
			},
			{
				label: "Freshness",
				value: `${topGrowing[0]?.tag.name ?? "—"}`,
				sub: "Most recently edited"
			}
		];
	}, [categoryGrowth, tags, topGrowing]);

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div>
						<CardTitle className="text-base">Usage Activity</CardTitle>
						<CardDescription>Replay how tags evolved over the selected timeframe.</CardDescription>
					</div>
					<ToggleGroup type="single" value={timeframe} onValueChange={(value) => value && setTimeframe(value as "30" | "90")}>
						{TIMEFRAMES.map((frame) => (
							<ToggleGroupItem key={frame.value} value={frame.value} aria-label={frame.label}>
								{frame.label}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</CardHeader>
				<CardContent>
					<ReactECharts
						option={{
							tooltip: { trigger: "axis" },
							xAxis: { type: "category", data: timeline.dates, boundaryGap: false },
							yAxis: { type: "value", name: "Updates" },
							series: [
								{
									name: "Tag touchpoints",
									type: "line",
									areaStyle: { opacity: 0.25 },
									smooth: true,
									data: timeline.values,
									color: "#8b5cf6"
								}
							]
						}}
						style={{ height: 280 }}
					/>
				</CardContent>
			</Card>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Category growth</CardTitle>
						<CardDescription>Stacked activity by taxonomy.</CardDescription>
					</CardHeader>
					<CardContent>
						<ReactECharts
							option={{
								tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
								legend: { show: false },
								grid: { left: "3%", right: "3%", bottom: "3%", top: "10%", containLabel: true },
								xAxis: { type: "value" },
								yAxis: {
									type: "category",
									data: categoryGrowth.map((entry) => entry.category.name).slice(0, 6).reverse()
								},
								series: [
									{
										name: "Tags",
										type: "bar",
										stack: "total",
										label: { show: true, position: "insideRight" },
										itemStyle: {
											color: (params: any) => categoryGrowth.slice(0, 6).reverse()[params.dataIndex]?.category.color || "#6366f1"
										},
										data: categoryGrowth.map((entry) => entry.count).slice(0, 6).reverse()
									}
								]
							}}
							style={{ height: 280 }}
						/>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Top movers</CardTitle>
						<CardDescription>Recent edits and synthetic sparkline signals.</CardDescription>
					</CardHeader>
					<CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{topGrowing.map(({ tag, series }) => (
							<div key={tag.id} className="rounded-lg border p-3">
								<div className="flex items-center justify-between text-sm font-medium">
									<span>{tag.name}</span>
									<span className="text-xs text-muted-foreground">{getSafeDate(tag.updated_at ?? tag.created_at).toLocaleDateString()}</span>
								</div>
								<ReactECharts
									option={{
										grid: { top: 10, bottom: 10, left: 0, right: 0 },
										xAxis: { type: "category", show: false, data: series.map((_, index) => index) },
										yAxis: { type: "value", show: false },
										series: [{ type: "line", data: series, smooth: true, showSymbol: false, areaStyle: { opacity: 0.15 }, color: tag.color || "#a855f7" }]
									}}
									style={{ height: 80 }}
								/>
							</div>
						))}
						{!topGrowing.length && <p className="text-muted-foreground text-sm">No activity yet.</p>}
					</CardContent>
				</Card>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{insights.map((insight) => (
					<Card key={insight.label}>
						<CardContent className="pt-6">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">{insight.label}</p>
							<p className="text-2xl font-semibold mt-2">{insight.value}</p>
							<p className="text-xs text-muted-foreground mt-1">{insight.sub}</p>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
