
import CheckboxAnimated from "@/animated/Checkbox";
import { Checkbox } from "@/components/ui/checkbox";
import { useId, useState } from "react";

export default function TestPage() {
  const [checked, setChecked] = useState(false);
  const id = useId();

  return (
    <div className="p-6">
      <label htmlFor={id} className="inline-flex items-center gap-3 cursor-pointer select-none">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(checked) => setChecked(Boolean(checked))}
        />

        <CheckboxAnimated
        />

        <span className="text-sm">Accept terms</span>
      </label>
    </div>
  );
}
