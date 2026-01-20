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

  const Row = ({ index, style }: RowComponentProps<{}>) => {
    const resource = sortedResources[index];
    if (!resource) return null;

    return (
      <div
        style={style}
        className={`resource-row px-3 py-2 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
          selectedResourceIds.has(resource.id) ? "bg-primary/10" : ""
        }`}
        onClick={() => onResourceSelect?.(resource.id)}
      >
        <div className="flex items-center gap-2">
          {resource.avatar ? (
            <img
              src={resource.avatar}
              alt={resource.name}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ backgroundColor: resource.color || "#6366f1" }}
            >
              {resource.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{resource.name}</div>
            {resource.teamName && (
              <div className="text-xs text-muted-foreground truncate">
                {resource.teamName}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="resource-list border-r bg-muted/30 flex flex-col"
      style={{ width: 200 }}
    >
      <div className="sticky top-0 bg-background border-b p-2 font-semibold text-sm z-10">
        Resources
      </div>
      <div className="flex-1 min-h-0">
        {sortedResources.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No resources available
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
