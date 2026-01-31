import { Template, Task, Category, Approval } from "@/store/types";

export interface TemplateFormData {
  name: string;
  description: string;
  instructions: string;
  category_id: string;
  priority_id: string;
  sla_id: string;
  approval_id: string;
  form_id: string;
  default_spot_id: string;
  spots_not_applicable: boolean;
  expected_duration: string;
  enabled: boolean;
  is_private: boolean;
}

export interface TemplateStatistics {
  totalTemplates: number;
  withDefaultSpot: number;
  withDefaultUsers: number;
  withExpectedDuration: number;
  mostUsedTemplates: Array<{ template: Template; count: number }>;
  urgentTasksCount: number;
  tasksWithApprovalsCount: number;
  latestTasks: Task[];
  templatesByCategory: Array<{ category: Category; count: number }>;
  tasksOverTime: Array<{ date: string; count: number }>;
}
