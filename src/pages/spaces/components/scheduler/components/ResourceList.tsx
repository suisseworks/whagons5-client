import { useMemo, useRef, useEffect, useState } from "react";
import { List, useListRef, type ListImperativeAPI, type RowComponentProps } from "react-window";
import type { SchedulerResource } from "../types/scheduler";

interface ResourceListProps {
  resources: SchedulerResource[];
  rowHeight: number;
  selectedResourceIds?: Set<number>;
  onResourceSelect?: (resourceId: number) => void;
}

export default function ResourceList({
  resources,
  rowHeight,
  selectedResourceIds = new Set(),
  onResourceSelect,
}: ResourceListProps) {
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  
  const sortedResources = useMemo(() => {
    return [...resources].sort((a, b) => {
      // Sort by team, then by name
      if (a.teamName && b.teamName) {
        if (a.teamName !== b.teamName) {
          return a.teamName.localeCompare(b.teamName);
        }
      }
      return a.name.localeCompare(b.name);
    });
  }, [resources]);

  const listRef = useListRef<ListImperativeAPI>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(600);
  
  const handleImageError = (resourceId: number) => {
    setImageErrors(prev => new Set(prev).add(resourceId));
  };

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setListHeight(rect.height - 40); // Subtract header height
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Get initials from name
  const getInitials = (name: string): string => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Generate consistent color from name
  const getColorFromName = (name: string, providedColor?: string): string => {
    if (providedColor) return providedColor;
    
    const colors = [
      '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
      '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
      '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const Row = ({ index, style }: RowComponentProps<{}>) => {
    const resource = sortedResources[index];
    
    if (!resource) return null;

    const hasImageError = imageErrors.has(resource.id);
    const showFallback = !resource.avatar || resource.avatar === '' || hasImageError;
    const isSelected = selectedResourceIds.has(resource.id);
    const avatarColor = getColorFromName(resource.name, resource.color);
    const isEven = index % 2 === 0;

    return (
      <div
        style={{
          ...style,
          height: rowHeight,
          display: 'flex',
          alignItems: 'center',
        }}
        className={`scheduler-resource-row group px-4 cursor-pointer transition-all duration-200 ease-out ${
          isSelected
            ? "bg-primary/8 border-l-[3px] border-l-primary"
            : isEven 
              ? "bg-transparent hover:bg-muted/40 border-l-[3px] border-l-transparent" 
              : "bg-muted/15 hover:bg-muted/50 border-l-[3px] border-l-transparent"
        }`}
        onClick={() => onResourceSelect?.(resource.id)}
      >
        <div className="flex items-center gap-3.5 w-full min-w-0">
          {/* Avatar with modern styling */}
          {showFallback ? (
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0 transition-all duration-200 ${
                isSelected 
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105" 
                  : "group-hover:scale-105 group-hover:shadow-lg"
              }`}
              style={{ 
                background: `linear-gradient(135deg, ${lightenColorSimple(avatarColor, 10)} 0%, ${avatarColor} 50%, ${darkenColorSimple(avatarColor, 10)} 100%)`,
                boxShadow: `0 4px 12px ${avatarColor}35, 0 2px 4px ${avatarColor}20`
              }}
            >
              {getInitials(resource.name)}
            </div>
          ) : (
            <img
              src={resource.avatar}
              alt={resource.name}
              className={`w-10 h-10 rounded-full object-cover flex-shrink-0 transition-all duration-200 ${
                isSelected 
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105" 
                  : "group-hover:scale-105 group-hover:shadow-lg"
              }`}
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)' }}
              onError={() => handleImageError(resource.id)}
            />
          )}
          
          {/* Name and Team with refined typography */}
          <div className="flex-1 min-w-0">
            <div className={`text-[13px] font-medium truncate leading-tight tracking-[-0.01em] transition-colors duration-200 ${
              isSelected ? "text-primary" : "text-foreground group-hover:text-foreground/90"
            }`}>
              {resource.name}
            </div>
            {resource.teamName && (
              <div className="flex items-center gap-1 mt-1.5">
                <span 
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider uppercase truncate max-w-full transition-all duration-200"
                  style={{ 
                    backgroundColor: `${avatarColor}12`,
                    color: avatarColor,
                    boxShadow: `0 0 0 1px ${avatarColor}15`
                  }}
                >
                  {resource.teamName}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Helper functions for color manipulation
  function lightenColorSimple(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + Math.round(255 * percent / 100));
    const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(255 * percent / 100));
    const b = Math.min(255, (num & 0x0000FF) + Math.round(255 * percent / 100));
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  function darkenColorSimple(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - Math.round(255 * percent / 100));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * percent / 100));
    const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * percent / 100));
    return `rgb(${r}, ${g}, ${b})`;
  }

  return (
    <div
      ref={containerRef}
      className="scheduler-resource-list border-r border-border/30 bg-gradient-to-b from-background via-background to-muted/10 flex flex-col"
      style={{ width: 260 }}
    >
      {/* Header with modern styling */}
      <div 
        className="sticky top-0 bg-gradient-to-r from-muted/30 via-muted/20 to-transparent border-b border-border/30 px-4 font-medium text-sm z-10 flex items-center justify-between backdrop-blur-md"
        style={{ height: 48 }}
      >
        <span className="text-foreground/85 tracking-tight font-semibold text-[13px]">Resources</span>
        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full shadow-sm">
          {sortedResources.length}
        </span>
      </div>
      
      {/* List */}
      <div className="flex-1 min-h-0">
        {sortedResources.length === 0 ? (
          <div className="scheduler-empty p-8 text-center flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-muted-foreground/70">No resources</div>
            <div className="text-xs text-muted-foreground/50 mt-1.5 max-w-[180px]">Select users to display in the scheduler</div>
          </div>
        ) : (
          <List
            listRef={listRef}
            rowCount={sortedResources.length}
            rowHeight={rowHeight}
            rowComponent={Row}
            rowProps={{}}
            style={{ height: listHeight, width: "100%" }}
          />
        )}
      </div>
    </div>
  );
}
