import { ICellRendererParams } from 'ag-grid-community';
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/providers/LanguageProvider";

export const EnabledCellRenderer = ({ value }: ICellRendererParams) => {
  const isEnabled = Boolean(value);
  const { t } = useLanguage();
  const tc = (key: string, fallback: string) => t(`settings.categories.${key}`, fallback);

  return (
    <Badge
      variant={isEnabled ? "default" : "secondary"}
      className={`text-xs ${isEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
    >
      {isEnabled ? tc('grid.values.enabled', 'Enabled') : tc('grid.values.disabled', 'Disabled')}
    </Badge>
  );
};
