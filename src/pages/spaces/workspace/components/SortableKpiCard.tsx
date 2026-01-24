import React, { type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WorkspaceKpiCard } from '@/pages/spaces/components/WorkspaceKpiCard';

interface SortableKpiCardProps {
  id: number;
  card: {
    label: string;
    value: string;
    icon: ReactNode;
    accent: 'indigo' | 'amber' | 'emerald' | 'purple';
    sparkline?: ReactNode;
    helperText?: string;
  };
}

export const SortableKpiCard: React.FC<SortableKpiCardProps> = ({ id, card }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing h-full"
    >
      <WorkspaceKpiCard
        label={card.label}
        value={card.value}
        icon={card.icon}
        accent={card.accent}
        helperText={card.helperText}
        right={card.sparkline}
      />
    </div>
  );
};
