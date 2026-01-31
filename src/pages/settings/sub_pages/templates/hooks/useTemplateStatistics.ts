import { useState, useCallback, useRef, useEffect } from "react";
import { Template, Task, Category, Priority } from "@/store/types";
import { TemplateStatistics } from "@/pages/settings/sub_pages/templates/types";
import dayjs from "dayjs";

interface UseTemplateStatisticsProps {
  templates: Template[];
  tasks: Task[];
  priorities: Priority[];
  categories: Category[];
  activeTab: string;
}

export const useTemplateStatistics = ({
  templates,
  tasks,
  priorities,
  categories,
  activeTab
}: UseTemplateStatisticsProps) => {
  const [statistics, setStatistics] = useState<TemplateStatistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const isCalculatingRef = useRef(false);

  const calculateStatistics = useCallback(async () => {
    if (isCalculatingRef.current) return;
    
    isCalculatingRef.current = true;
    setStatsLoading(true);
    
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const templateTasks = tasks.filter((task: Task) => task.template_id !== null);
      
      // Most used templates
      const templateUsage = new Map<number, number>();
      templateTasks.forEach((task: Task) => {
        if (task.template_id) {
          templateUsage.set(task.template_id, (templateUsage.get(task.template_id) || 0) + 1);
        }
      });
      
      const mostUsedTemplates = Array.from(templateUsage.entries())
        .map(([templateId, count]) => ({
          template: templates.find((t: Template) => t.id === templateId)!,
          count
        }))
        .filter(item => item.template)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Urgent tasks
      const urgentTasksCount = templateTasks.filter((task: Task) => {
        const priority = (priorities as any[]).find((p: any) => p.id === task.priority_id);
        if (priority?.level && priority.level >= 4) return true;
        if (priority?.name) {
          const nameLower = priority.name.toLowerCase();
          return nameLower.includes('urgent') || nameLower.includes('critical') || nameLower.includes('high');
        }
        return false;
      }).length;

      // Tasks with approvals
      const tasksWithApprovalsCount = templateTasks.filter((task: Task) => 
        task.approval_id !== null && task.approval_id !== undefined
      ).length;

      // Latest tasks
      const latestTasks = [...templateTasks]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      // Templates by category
      const categoryCounts = new Map<number, number>();
      templates.forEach((template: Template) => {
        const catId = template.category_id;
        categoryCounts.set(catId, (categoryCounts.get(catId) || 0) + 1);
      });

      const templatesByCategory = Array.from(categoryCounts.entries())
        .map(([categoryId, count]) => ({
          category: (categories as Category[]).find((c: Category) => c.id === categoryId)!,
          count
        }))
        .filter(item => item.category)
        .sort((a, b) => b.count - a.count);

      // Tasks over time
      const tasksOverTimeMap = new Map<string, number>();
      templateTasks.forEach((task: Task) => {
        const date = dayjs(task.created_at).format('YYYY-MM-DD');
        tasksOverTimeMap.set(date, (tasksOverTimeMap.get(date) || 0) + 1);
      });

      const tasksOverTime = Array.from(tasksOverTimeMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      setStatistics({
        totalTemplates: templates.length,
        withDefaultSpot: templates.filter((t: any) => t.default_spot_id).length,
        withDefaultUsers: templates.filter((t: any) => Array.isArray(t.default_user_ids) && t.default_user_ids.length > 0).length,
        withExpectedDuration: templates.filter((t: any) => (t.expected_duration ?? 0) > 0).length,
        mostUsedTemplates,
        urgentTasksCount,
        tasksWithApprovalsCount,
        latestTasks,
        templatesByCategory,
        tasksOverTime
      });
    } catch (error) {
      console.error('Error calculating statistics:', error);
    } finally {
      setStatsLoading(false);
      isCalculatingRef.current = false;
    }
  }, [templates, tasks, priorities, categories]);

  useEffect(() => {
    if (activeTab !== 'statistics') {
      setStatistics(null);
      return;
    }
    
    if (activeTab === 'statistics' && !isCalculatingRef.current) {
      setStatistics(null);
      calculateStatistics();
    }
  }, [activeTab, calculateStatistics]);

  return { statistics, statsLoading };
};
