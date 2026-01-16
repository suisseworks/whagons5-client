import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectCombobox } from '@/components/ui/multi-select-combobox';
import { normalizeFieldType, coerceBoolean, parseFieldOptions, parseMultiValue } from '../utils/fieldHelpers';
import { useLanguage } from '@/providers/LanguageProvider';

interface CustomFieldInputProps {
  field: any;
  value: any;
  onChange: (value: any) => void;
}

export function CustomFieldInput({ field, value, onChange }: CustomFieldInputProps) {
  const { t } = useLanguage();
  const type = normalizeFieldType(field);
  const options = parseFieldOptions(field);

  if (type === 'textarea') {
    return (
      <Textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('workspace.customFields.enterValue', 'Enter a value...')}
        className="min-h-[100px] px-4 py-3 rounded-[10px] text-sm focus:border-primary focus:ring-[3px] focus:ring-ring transition-all duration-150"
      />
    );
  }

  if (type === 'number') {
    return (
      <Input
        type="number"
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('workspace.customFields.enterNumber', 'Enter a number')}
        className="h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background"
      />
    );
  }

  if (type === 'checkbox') {
    return (
      <label className="inline-flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={coerceBoolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border border-border"
        />
        <span>{t('workspace.customFields.checkbox', 'Check')}</span>
      </label>
    );
  }

  if (type === 'list' || type === 'radio' || type === 'select') {
    return (
      <Select
        value={value ? String(value) : ""}
        onValueChange={(v) => onChange(v)}
      >
        <SelectTrigger 
          className="h-10 px-4 border border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background"
        >
          <SelectValue placeholder={t('workspace.customFields.selectOption', 'Select an option')} />
        </SelectTrigger>
        <SelectContent>
          {options.length ? options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          )) : (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">{t('workspace.customFields.noOptions', 'No options')}</div>
          )}
        </SelectContent>
      </Select>
    );
  }

  if (type === 'multi_select' || type === 'multi-select' || type === 'multi select') {
    const values = Array.isArray(value) ? value.map(String) : parseMultiValue(value);
    return (
      <div className="[&_button]:border [&_button]:border-border [&_button]:bg-background [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:text-foreground [&_button]:transition-all [&_button]:duration-150 [&_button:hover]:border-border/70 [&_button]:focus-visible:border-primary [&_button]:focus-visible:ring-[3px] [&_button]:focus-visible:ring-ring [&_button]:focus-visible:bg-background">
        <MultiSelectCombobox
          options={options}
          value={values}
          onValueChange={(vals) => onChange(vals)}
          placeholder={t('workspace.customFields.selectOptions', 'Select options')}
          searchPlaceholder={t('workspace.customFields.search', 'Search...')}
          emptyText={t('workspace.customFields.noOptions', 'No options')}
          className="w-full"
        />
      </div>
    );
  }

  if (type === 'date') {
    return (
      <Input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background"
      />
    );
  }

  if (type.startsWith('datetime')) {
    return (
      <Input
        type="datetime-local"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background"
      />
    );
  }

  if (type === 'time') {
    return (
      <Input
        type="time"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background"
      />
    );
  }

  // TEXT or fallback
  return (
    <Input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('workspace.customFields.enterValue', 'Enter a value...')}
      className="h-10 px-4 border-border bg-background rounded-[10px] text-sm text-foreground transition-all duration-150 hover:border-border/70 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:bg-background"
    />
  );
}
