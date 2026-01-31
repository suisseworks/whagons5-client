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
  isSelected?: boolean;
  onClick?: () => void;
}

export const SortableKpiCard: React.FC<SortableKpiCardProps> = ({ id, card, isSelected, onClick }) => {
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

  // Track if we're dragging to prevent clicks
  const [wasDragging, setWasDragging] = React.useState(false);

  React.useEffect(() => {
    if (isDragging) {
      setWasDragging(true);
    } else if (wasDragging) {
      // Reset after a short delay to allow click to be prevented
      const timer = setTimeout(() => setWasDragging(false), 100);
      return () => clearTimeout(timer);
    }
  }, [isDragging, wasDragging]);

  const handleClick = (e: React.MouseEvent) => {
    // Prevent click if we just finished dragging
    if (wasDragging || isDragging) {
      e.stopPropagation();
      return;
    }
    // Handle click for filtering
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing h-full"
    >
      <div onClick={handleClick}>
        <WorkspaceKpiCard
          label={card.label}
          value={card.value}
          icon={card.icon}
          accent={card.accent}
          helperText={card.helperText}
          right={card.sparkline}
          isSelected={isSelected}
          onClick={undefined} // Don't pass onClick to avoid double handling
        />
      </div>
    </div>
  );
};
