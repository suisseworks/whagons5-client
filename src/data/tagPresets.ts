import type { Tag } from "@/store/types";

export interface TagPreset {
	id: string;
	name: string;
	description?: string;
	tags: Array<Pick<Tag, "name" | "color" | "icon" | "category_id">>;
}

export const TAG_PRESET_COLLECTIONS: TagPreset[] = [
	{
		id: "ops-health",
		name: "Ops Health",
		description: "Status tags for operational reviews and standups",
		tags: [
			{ name: "Needs Review", color: "#f97316", icon: "fas fa-search", category_id: null },
			{ name: "Blocked", color: "#ef4444", icon: "fas fa-ban", category_id: null },
			{ name: "Waiting Vendor", color: "#a855f7", icon: "fas fa-truck", category_id: null },
			{ name: "Audit", color: "#0ea5e9", icon: "fas fa-shield-alt", category_id: null }
		]
	},
	{
		id: "cx-sentiment",
		name: "CX Sentiment",
		description: "Customer success mood indicators",
		tags: [
			{ name: "Delight", color: "#22c55e", icon: "fas fa-smile-beam", category_id: null },
			{ name: "Neutral", color: "#94a3b8", icon: "fas fa-meh", category_id: null },
			{ name: "Rescue", color: "#ef4444", icon: "fas fa-lifebuoy", category_id: null }
		]
	},
	{
		id: "incident-pack",
		name: "Incident Pack",
		description: "Preset bundle for incident command centers",
		tags: [
			{ name: "Commander", color: "#facc15", icon: "fas fa-crown", category_id: null },
			{ name: "Communications", color: "#2dd4bf", icon: "fas fa-bullhorn", category_id: null },
			{ name: "Legal", color: "#3b82f6", icon: "fas fa-scale-balanced", category_id: null },
			{ name: "Security", color: "#6366f1", icon: "fas fa-user-shield", category_id: null }
		]
	}
];







