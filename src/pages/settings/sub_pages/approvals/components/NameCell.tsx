import type { ICellRendererParams } from "ag-grid-community";

// Compact name/description cell similar to Teams with type indicator (S/P)
export const NameCell = (props: ICellRendererParams) => {
  const name = props.value as string;
  const description = props.data?.description as string | null | undefined;
  const isActive = props.data?.is_active !== false;
  const typeRaw = String((props.data?.approval_type || "") as string).toUpperCase();
  const isParallel = typeRaw === "PARALLEL";
  const letter = isParallel ? "P" : "S";
  const color = isParallel ? "bg-emerald-500" : "bg-blue-500";
  return (
    <div className="flex items-center space-x-3 h-full">
      <div className={`h-6 w-6 rounded-full ${color} text-white text-xs font-semibold flex items-center justify-center shrink-0`}>
        {letter}
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`truncate ${isActive ? "" : "line-through opacity-60"}`}>{name}</span>
        {description ? (
          <span className={`text-xs text-muted-foreground truncate ${isActive ? "" : "line-through opacity-60"}`}>{description}</span>
        ) : null}
      </div>
    </div>
  );
};

