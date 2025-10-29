"use client";
import { motion } from "motion/react";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";
import DueDateCell from "./DueDateCell";
import TaskRowActions from "./TaskRowActions";
import { MapPin } from "lucide-react";

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
  getStatusIcon,
  onClick,
  onEdit,
  onDelete,
  onDuplicate,
  onMarkComplete,
}: {
  task: any;
  statusMap: Record<number, StatusMeta>;
  priorityMap: Record<number, PriorityMeta>;
  spotMap: Record<number, SpotMeta>;
  getStatusIcon?: (iconName?: string) => any;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMarkComplete?: () => void;
}) {
  // Priority color indicator removed per design feedback

  return (
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {(() => {
              const statusColor = statusMap?.[Number(task?.status_id)]?.color as string | undefined;
              const priorityName = priorityMap?.[Number(task?.priority_id)]?.name as string | undefined;
              const initial = ((priorityName || task?.name || "").trim().charAt(0) || "").toUpperCase();
              const baseCls = "w-6 h-6 min-w-[1.5rem] rounded-full flex items-center justify-center text-[11px] font-semibold";
              const cls = statusColor ? `${baseCls} text-white` : `${baseCls} bg-muted text-foreground/80 border`;
              const style = statusColor ? { backgroundColor: statusColor } : undefined;
              return (
                <span className={cls} style={style} aria-hidden>
                  {initial}
                </span>
              );
            })()}
            <h3
              className="text-[15px] font-medium text-foreground tracking-[-0.02em] leading-5 truncate"
              title={task?.name || "Untitled task"}
            >
              {task?.name || "Untitled task"}
            </h3>
          </div>

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

        <div className="flex items-center gap-1">
          <TaskRowActions
            onEdit={onEdit}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onMarkComplete={onMarkComplete}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default TaskRow;


