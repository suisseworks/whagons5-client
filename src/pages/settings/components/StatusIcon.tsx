import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { iconService } from "@/database/iconService";

function parseFaIconName(iconStr: string): string {
  if (!iconStr) return "";
  const faMatch = iconStr.match(/^(?:fas|far|fal|fat|fab|fad|fass)\s+fa-(.+)$/);
  if (faMatch) return faMatch[1];
  if (iconStr.startsWith("fa-")) return iconStr.substring(3);
  return iconStr;
}

export function StatusIcon({ icon, color }: { icon: string; color: string }) {
  const [def, setDef] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const name = parseFaIconName(icon);
      const loaded = await iconService.getIcon(name);
      if (mounted) setDef(loaded);
    })();
    return () => {
      mounted = false;
    };
  }, [icon]);

  if (def) {
    return <FontAwesomeIcon icon={def as any} className="w-4 h-4" style={{ color }} />;
  }
  return <span className="inline-block w-4 h-4 rounded-full border" style={{ backgroundColor: color }} />;
}



