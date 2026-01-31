import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTags } from "@fortawesome/free-solid-svg-icons";
import { Badge } from "@/components/ui/badge";
import { Category, Team } from "@/store/types";
import { iconService } from '@/database/iconService';

interface CategoryPreviewProps {
  category: Category;
  teams: Team[];
  getCategoryTaskCount: (categoryId: number) => number;
  translate: (key: string, fallback: string) => string;
}

export const CategoryPreview = ({ category, teams, getCategoryTaskCount, translate: tc }: CategoryPreviewProps) => {
  const [icon, setIcon] = useState<any>(faTags);

  useEffect(() => {
    const loadIcon = async () => {
      if (!category.icon) {
        setIcon(faTags);
        return;
      }

      try {
        const iconClasses = category.icon.split(' ');
        const iconName = iconClasses[iconClasses.length - 1];
        const loadedIcon = await iconService.getIcon(iconName);
        setIcon(loadedIcon || faTags);
      } catch (error) {
        console.error('Error loading category preview icon:', error);
        setIcon(faTags);
      }
    };

    loadIcon();
  }, [category.icon]);

  return (
    <div className="flex items-center space-x-3">
      <FontAwesomeIcon
        icon={icon}
        className="w-5 h-5"
        style={{ color: category.color }}
      />
      <div>
        <div className="font-medium">{category.name}</div>
        <div className="text-sm text-muted-foreground">{category.description}</div>
        <div className="flex items-center space-x-2 mt-1">
          {category.team_id && (() => {
            const team = teams.find((t: Team) => t.id === category.team_id);
            return (
              <div className="flex items-center space-x-1">
                <div 
                  className="w-4 h-4 min-w-[1rem] text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                  style={{ backgroundColor: team?.color ?? '#6B7280' }}
                >
                  {team?.name?.charAt(0).toUpperCase() || 'T'}
                </div>
                <span className="text-xs text-muted-foreground">
                  {team?.name || `Team ${category.team_id}`}
                </span>
              </div>
            );
          })()}
          <Badge
            variant={category.enabled ? "default" : "secondary"}
            className={`text-xs ${category.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
          >
            {category.enabled ? tc('grid.values.enabled', 'Enabled') : tc('grid.values.disabled', 'Disabled')}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {getCategoryTaskCount(category.id)} {getCategoryTaskCount(category.id) !== 1 ? tc('preview.tasks', 'tasks') : tc('preview.task', 'task')}
          </span>
        </div>
      </div>
    </div>
  );
};
