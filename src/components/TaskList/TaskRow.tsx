"use client";
import { motion } from "motion/react";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";
import DueDateCell from "./DueDateCell";
import TaskRowActions from "./TaskRowActions";
import { MapPin, NotebookPen, Trash2, MoreVertical } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTags } from "@fortawesome/free-solid-svg-icons";
import { iconService } from "@/database/iconService";
import { useEffect, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type StatusMeta = { id: number; name: string; color?: string; icon?: string };
type PriorityMeta = { id: number; name: string; color?: string };
type SpotMeta = { id: number; name: string };

export const taskVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 },
  },
};

export function TaskRow({
  task,
  statusMap,
  priorityMap,
  spotMap,
  categoryMap,
  getStatusIcon,
  onClick,
  onEdit,
  onDelete,
  onDuplicate,
  onMarkComplete,
  onLog,
  density = 'comfortable',
}: {
  task: any;
  statusMap: Record<number, StatusMeta>;
  priorityMap: Record<number, PriorityMeta>;
  spotMap: Record<number, SpotMeta>;
  categoryMap?: Record<number, { id: number; name: string; color?: string; icon?: string }>;
  getStatusIcon?: (iconName?: string) => any;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMarkComplete?: () => void;
  onLog?: () => void;
  density?: 'compact' | 'comfortable' | 'spacious';
}) {
  // Priority color indicator removed per design feedback
  const CategoryIcon = ({ iconClass, color }: { iconClass?: string; color?: string }) => {
    const [iconEl, setIconEl] = useState<any>(null);
    useEffect(() => {
      let cancelled = false;
      (async () => {
        // Don't set anything if iconClass is not available yet - wait for it to load
        if (!iconClass) {
          setIconEl(null);
          return;
        }
        
        try {
          const loaded = await iconService.getIcon(iconClass);
          if (!cancelled) setIconEl(loaded || faTags);
        } catch {
          if (!cancelled) setIconEl(faTags);
        }
      })();
      return () => { cancelled = true; };
    }, [iconClass]);
    const iconColor = color || '#6b7280';
    
    // Don't render anything until we have an iconClass prop and icon is loaded
    if (!iconClass || !iconEl) {
      return null;
    }
    
    return (
      <div 
        className="w-6 h-6 min-w-[1.5rem] rounded-lg flex items-center justify-center flex-shrink-0 mr-1"
        style={{ backgroundColor: iconColor }}
      >
        <FontAwesomeIcon 
          icon={iconEl as any} 
          style={{ color: '#ffffff', fontSize: '12px' }}
          className="text-white"
        />
      </div>
    );
  };

  return (
    <ContextMenu>
      <motion.div
        variants={taskVariants}
        initial="hidden"
        animate="visible"
        className="group relative overflow-hidden border border-[#E5E7EB] bg-card rounded-xl px-6 py-5 hover:shadow-lg transition-all duration-200 cursor-pointer"
        onClick={onClick}
        style={{
          transformOrigin: "center",
        }}
      >
        <div className="flex items-start gap-4">
          <div className="pt-1">
            <ContextMenuTrigger asChild>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center rounded-full border border-border bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label="Task actions"
              >
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            </ContextMenuTrigger>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {(() => {
                const cat = categoryMap?.[Number(task?.category_id)];
                return <CategoryIcon iconClass={cat?.icon} color={cat?.color} />;
              })()}
              <span className="text-[12px] font-mono text-muted-foreground px-2 py-0.5 rounded-md bg-muted/60 border border-border">
                #{task?.id ?? "—"}
              </span>
              <h3
                className="text-[18px] font-semibold text-[#0f172a] tracking-[-0.02em] leading-6 truncate"
                title={task?.name || "Untitled task"}
              >
                {task?.name || "Untitled task"}
              </h3>
            </div>

            {task?.description ? (
              <div
                className="text-[13px] text-muted-foreground mb-2"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: density === 'spacious' ? 3 : 1,
                  WebkitBoxOrient: 'vertical' as any,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {task.description}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusBadge statusId={task?.status_id} statusMap={statusMap} getStatusIcon={getStatusIcon} />
              <PriorityBadge priorityId={task?.priority_id} priorityMap={priorityMap} />
              <DueDateCell dueDate={task?.due_date} />

              {task?.spot_id != null && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] bg-muted text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[160px]" title={spotMap[Number(task.spot_id)]?.name || `#${task.spot_id}`}>
                    {spotMap[Number(task.spot_id)]?.name || `#${task.spot_id}`}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Position actions in the top-right corner so they aren't visually attached to the priority pill */}
        <div className="absolute top-4 right-4">
          <TaskRowActions
            onEdit={onEdit}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onMarkComplete={onMarkComplete}
          />
        </div>
      </motion.div>
      <ContextMenuContent align="end" className="w-48">
        <ContextMenuLabel>Task</ContextMenuLabel>
        <ContextMenuItem className="text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onLog}>
          <NotebookPen className="h-4 w-4 mr-2" />
          Log
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default TaskRow;


