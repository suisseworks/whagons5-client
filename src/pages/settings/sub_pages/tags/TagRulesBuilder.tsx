import { useMemo, useState } from "react";
import type { Category, Tag } from "@/store/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { readSettingsLocal, updateSettingsLocal } from "@/lib/settingsLocalStore";
import { nanoid } from "nanoid";

interface RuleCondition {
	field: "category" | "name" | "color";
	operator: "equals" | "contains" | "starts_with";
	value: string;
}

interface RuleAction {
	type: "suggest" | "flag";
	payload: string;
}

export interface TagRule {
	id: string;
	name: string;
	conditions: RuleCondition[];
	actions: RuleAction[];
	enabled: boolean;
	order: number;
}

interface TagRulesBuilderProps {
	tags: Tag[];
	categories: Category[];
}

const STORAGE_KEY = "settings:tag-rules";

const RULE_TEMPLATES: Array<Omit<TagRule, "id" | "order">> = [
	{
		name: "Escalate Blockers",
		conditions: [{ field: "name", operator: "contains", value: "block" }],
		actions: [
			{ type: "flag", payload: "Escalate to operations" },
			{ type: "suggest", payload: "Blocked" }
		],
		enabled: true
	},
	{
		name: "Vendor Coordination",
		conditions: [
			{ field: "category", operator: "equals", value: "Vendors" },
			{ field: "name", operator: "contains", value: "waiting" }
		],
		actions: [{ type: "suggest", payload: "Waiting Vendor" }],
		enabled: true
	},
	{
		name: "Color Harmony",
		conditions: [{ field: "color", operator: "equals", value: "#ef4444" }],
		actions: [{ type: "flag", payload: "Ensure consistent alert severity" }],
		enabled: false
	}
];

export default function TagRulesBuilder({ tags, categories }: TagRulesBuilderProps) {
	const [rules, setRules] = useState<TagRule[]>(() => {
		const saved = readSettingsLocal<TagRule[]>(STORAGE_KEY, []);
		return saved.length ? saved : RULE_TEMPLATES.map((template, index) => ({ ...template, id: nanoid(), order: index }));
	});
	const [filter, setFilter] = useState<string>("");

	const persist = (nextRules: TagRule[]) => {
		setRules(nextRules);
		updateSettingsLocal(STORAGE_KEY, () => nextRules, nextRules);
	};

	const addBlankRule = () => {
		const next: TagRule = {
			id: nanoid(),
			name: "New automation",
			conditions: [{ field: "name", operator: "contains", value: "" }],
			actions: [{ type: "suggest", payload: "" }],
			enabled: true,
			order: rules.length
		};
		persist([...rules, next]);
	};

	const toggleRule = (id: string, enabled: boolean) => {
		persist(rules.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)));
	};

	const updateRuleName = (id: string, value: string) => {
		persist(rules.map((rule) => (rule.id === id ? { ...rule, name: value } : rule)));
	};

	const deleteRule = (id: string) => {
		persist(
			rules
				.filter((rule) => rule.id !== id)
				.map((rule, index) => ({
					...rule,
					order: index
				}))
		);
	};

	const moveRule = (id: string, direction: "up" | "down") => {
		const index = rules.findIndex((rule) => rule.id === id);
		const targetIndex = direction === "up" ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= rules.length) return;

		const reordered = [...rules];
		const [removed] = reordered.splice(index, 1);
		reordered.splice(targetIndex, 0, removed);
		persist(
			reordered.map((rule, order) => ({
				...rule,
				order
			}))
		);
	};

	const applyTemplate = (template: Omit<TagRule, "id" | "order">) => {
		const next = { ...template, id: nanoid(), order: rules.length };
		persist([...rules, next]);
	};

	const filteredRules = useMemo(() => {
		if (!filter) return rules;
		return rules.filter((rule) => rule.name.toLowerCase().includes(filter.toLowerCase()));
	}, [rules, filter]);

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div>
						<CardTitle className="text-base">Workflow Rules</CardTitle>
						<CardDescription>Prototype automation to suggest or flag tags during intake.</CardDescription>
					</div>
					<div className="flex gap-2">
						<Input
							placeholder="Filter rules..."
							value={filter}
							onChange={(event) => setFilter(event.target.value)}
							className="w-48"
						/>
						<Button variant="outline" onClick={addBlankRule}>
							Add Rule
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap gap-2">
						{RULE_TEMPLATES.map((template) => (
							<Button key={template.name} size="sm" variant="secondary" onClick={() => applyTemplate(template)}>
								Use “{template.name}”
							</Button>
						))}
					</div>
					<div className="space-y-3">
						{filteredRules.map((rule, index) => (
							<Card key={rule.id} className={rule.enabled ? "" : "opacity-60"}>
								<CardContent className="pt-6 space-y-4">
									<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
										<Input value={rule.name} onChange={(event) => updateRuleName(rule.id, event.target.value)} />
										<div className="flex items-center gap-3">
											<div className="flex items-center gap-2">
												<Switch checked={rule.enabled} onCheckedChange={(checked) => toggleRule(rule.id, checked)} id={`switch-${rule.id}`} />
												<Label htmlFor={`switch-${rule.id}`}>Enabled</Label>
											</div>
											<div className="flex gap-1">
												<Button size="icon" variant="ghost" onClick={() => moveRule(rule.id, "up")} disabled={index === 0}>
													↑
												</Button>
												<Button size="icon" variant="ghost" onClick={() => moveRule(rule.id, "down")} disabled={index === rules.length - 1}>
													↓
												</Button>
												<Button size="icon" variant="ghost" onClick={() => deleteRule(rule.id)}>
													✕
												</Button>
											</div>
										</div>
									</div>
									<div className="space-y-2">
										<Label className="text-xs uppercase tracking-wide text-muted-foreground">Conditions</Label>
										<div className="flex flex-wrap gap-2">
											{rule.conditions.map((condition, conditionIndex) => (
												<Badge key={`${rule.id}-cond-${conditionIndex}`} variant="outline" className="text-xs">
													{condition.field} {condition.operator} “{condition.value || "any"}”
												</Badge>
											))}
										</div>
									</div>
									<div className="space-y-2">
										<Label className="text-xs uppercase tracking-wide text-muted-foreground">Actions</Label>
										<div className="flex flex-wrap gap-2">
											{rule.actions.map((action, actionIndex) => (
												<Badge key={`${rule.id}-act-${actionIndex}`} className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
													{action.type === "suggest" ? "Suggest" : "Flag"} {action.payload || "Tag"}
												</Badge>
											))}
										</div>
									</div>
								</CardContent>
							</Card>
						))}
						{!filteredRules.length && <p className="text-sm text-muted-foreground">No rules found. Try another filter or add a new automation.</p>}
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">What would these rules power?</CardTitle>
					<CardDescription>Today they simulate guidance locally. Later they can drive backend webhooks to auto-label tasks.</CardDescription>
				</CardHeader>
				<CardContent className="text-sm text-muted-foreground space-y-2">
					<p>• During task creation, match conditions to recommend tags and highlight missing metadata.</p>
					<p>• Emit events to the workflow engine once backend hooks are available.</p>
					<p>• Document governance by exporting the JSON blueprint to the config repository.</p>
				</CardContent>
			</Card>
		</div>
	);
}







