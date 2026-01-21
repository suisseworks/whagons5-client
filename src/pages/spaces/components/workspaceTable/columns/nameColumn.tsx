/**
 * Name column definition with category icon, tags, description, and latest comment
 */

import { MessageSquare } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconBadge, useIconDefinition } from '../columnUtils/icon';
import { getContrastTextColor } from '../columnUtils/color';
import { ColumnBuilderOptions } from './types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTags } from '@fortawesome/free-solid-svg-icons';

/**
 * Small tag icon component for inline use in tag badges
 */
const TagIconSmall = (props: { iconClass?: string | null; color?: string }) => {
  const iconDef = useIconDefinition(props.iconClass, faTags);
  return (
    <FontAwesomeIcon 
      icon={iconDef || faTags} 
      className="w-3 h-3 flex-shrink-0"
      style={{ color: props.color || '#ffffff' }}
    />
  );
};

export function createNameColumn(opts: ColumnBuilderOptions, latestNoteByTaskId: Map<number, { text: string; ts: number }>) {
  const {
    categoryMap,
    tagMap,
    taskTagsMap,
    tagDisplayMode = 'icon-text',
    showDescriptions,
    density = 'comfortable',
  } = opts;

  return {
    field: 'name',
    headerName: 'Name',
    flex: 3.8,
    filter: false,
    cellRenderer: (p: any) => {
      // Loading placeholder when row data isn't ready (infinite row model)
      if (!p.data) {
        return (
          <div className="flex flex-col gap-2 py-2 min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-muted animate-pulse" />
              <div className="h-4 w-[40%] bg-muted animate-pulse rounded" />
            </div>
            <div className="h-3 w-[60%] bg-muted/70 animate-pulse rounded ml-8" />
          </div>
        );
      }
      const name = p.data?.name || '';
      const description = p.data?.description || '';
      const cat = categoryMap?.[Number(p.data?.category_id)];
      
      // Get tags for this task
      const taskId = Number(p.data?.id);
      const latestComment = density === 'compact'
        ? ''
        : ((latestNoteByTaskId.get(taskId)?.text || '') as string).trim();
      const taskTagIds = (taskTagsMap && taskTagsMap.get(taskId)) || [];
      const taskTagsData = (taskTagIds || [])
        .map((tagId: number) => {
          const tag = tagMap?.[tagId];
          return tag && tag.name ? { ...tag, id: tagId } : null;
        })
        .filter((tag: any) => tag !== null);

      const node = (
        <div className="flex flex-col gap-1.5 py-1.5 min-w-0">
          {/* Name row with category icon */}
          <div className="flex items-center gap-2.5 min-w-0">
            <IconBadge iconClass={cat?.icon} color={cat?.color} />
            <div className="font-semibold text-[15px] leading-[1.4] cursor-default text-foreground min-w-0 flex-1 truncate tracking-[0.01em]">{name}</div>
          </div>
          {/* Tags row - separate line below name for better visual separation */}
          {(taskTagsData && taskTagsData.length > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap pl-[34px] min-w-0">
              {taskTagsData.map((tag: any, idx: number) => {
                if (!tag || !tag.name) return null;
                const bgColor = tag.color || '#6B7280';
                const textColor = getContrastTextColor(bgColor);
                return (
                  <div
                    key={tag.id || `tag-${idx}`}
                    className={`inline-flex items-center ${tagDisplayMode === 'icon' ? 'gap-0 px-1.5' : 'gap-1.5 px-2'} py-0.5 rounded-md text-[11px] font-medium leading-none flex-shrink-0 shadow-sm`}
                    style={{
                      backgroundColor: bgColor,
                      color: textColor,
                    }}
                    title={tag.name}
                  >
                    <TagIconSmall iconClass={tag.icon} color={textColor} />
                    {tagDisplayMode === 'icon-text' && (
                      <span className="whitespace-nowrap">{tag.name}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {showDescriptions && description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="wh-task-desc mt-0.5 pl-[34px] text-[12px] leading-relaxed text-muted-foreground/75"
                    style={{
                      whiteSpace: 'normal',
                      display: '-webkit-box',
                      WebkitLineClamp: density === 'spacious' ? 3 : 1,
                      WebkitBoxOrient: 'vertical' as any,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      opacity: 0.7,
                    }}
                  >
                    {description}
                  </div>
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  align="start"
                  sideOffset={8}
                  collisionPadding={{ left: 300, right: 16, top: 16, bottom: 16 }}
                  avoidCollisions={true}
                  className="max-w-[520px] whitespace-pre-wrap text-base leading-relaxed z-[100]"
                  style={{ 
                    maxWidth: 'min(520px, calc(100vw - 340px))'
                  }}
                >
                  {description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {density !== 'compact' && latestComment && (
            <div className="flex items-start gap-1.5 pl-[34px] text-[12px] text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5 mt-[1px]" />
              <span
                className="leading-relaxed min-w-0"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical' as any,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {latestComment}
              </span>
            </div>
          )}
        </div>
      );
      const shouldShowHoverDescription = !!description && (density === 'compact' || density === 'comfortable');
      if (shouldShowHoverDescription) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {node}
              </TooltipTrigger>
              <TooltipContent 
                side="bottom" 
                align="start"
                sideOffset={8}
                collisionPadding={{ left: 300, right: 16, top: 16, bottom: 16 }}
                avoidCollisions={true}
                className="max-w-[520px] whitespace-pre-wrap text-base leading-relaxed z-[100]"
                style={{ 
                  maxWidth: 'min(520px, calc(100vw - 340px))'
                }}
              >
                {description}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      return node;
    },
    minWidth: 320,
  };
}
