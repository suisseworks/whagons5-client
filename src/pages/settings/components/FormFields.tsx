import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPicker, ColorPickerAlpha, ColorPickerFormat, ColorPickerHue, ColorPickerSelection, ColorPickerEyeDropper } from "@/components/ui/shadcn-io/color-picker";
import Color, { ColorLike } from "color";

export interface FormFieldProps {
  id?: string;
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  hideLabel?: boolean;
}

export function FormField({
  id,
  label,
  required = false,
  className = "",
  children,
  hideLabel = false,
}: FormFieldProps) {
  const gridColumnsClass = hideLabel ? "grid-cols-1" : "grid-cols-4";
  const contentSpanClass = hideLabel ? "col-span-1" : "col-span-3";

  return (
    <div className={`grid ${gridColumnsClass} items-center gap-4 ${className}`}>
      {!hideLabel && (
        <Label htmlFor={id} className="text-right">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className={contentSpanClass}>
        {children}
      </div>
    </div>
  );
}

export interface TextFieldProps {
  id?: string;
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "email" | "password" | "number" | "color" | "date" | "datetime-local";
  min?: string | number;
  max?: string | number;
  className?: string;
}



export function TextField({
  id,
  label,
  name,
  value,
  defaultValue,
  onChange,
  placeholder,
  required = false,
  type = "text",
  min,
  max,
  className = ""
}: TextFieldProps) {
  const isControlled = value !== undefined && onChange !== undefined;
  const inputProps = isControlled
    ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) }
    : { defaultValue };

  return (
    <FormField id={id} label={label} required={required} className={className}>
      {type === "color" ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              className="h-9 w-16 rounded-md border border-input shadow-sm ring-offset-background transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              style={{ backgroundColor: isControlled ? value : defaultValue }}
              aria-label="Open color picker"
            />
          </PopoverTrigger>
          <PopoverContent
            className=" w-72 pointer-events-auto select-text"
            align="start"
            side="top"
            sideOffset={8}
            avoidCollisions={false}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {(() => {
              const colorValue = isControlled ? value : defaultValue;
              // Handle empty or invalid color values
              if (!colorValue || colorValue.trim() === '') {
                return (
                  <ColorPicker
                    className="max-w-xs rounded-md p-2"
                    defaultValue="#000000"
                    onChange={(color : ColorLike) => {
                      const colorInstance = new Color(color);
                      const hex = colorInstance.hex();
                      if (isControlled && onChange) {
                        onChange(hex);
                      }
                    }}
                  >
                    <div className="aspect-square w-full rounded-md border">
                      <ColorPickerSelection className="h-full w-full" />
                    </div>
                    <div className="flex items-center gap-3">
                      <ColorPickerEyeDropper  />
                      <div className="grid w-full gap-1">
                        <ColorPickerHue  />
                        <ColorPickerAlpha />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ColorPickerFormat />
                    </div>
                  </ColorPicker>
                );
              }
              try {
                let realColor = new Color(colorValue);
                let stringColor = realColor.toString();
                return (
                  <ColorPicker
                    className="max-w-xs rounded-md p-2"
                    defaultValue={stringColor || "#000000"}
                    onChange={(color : ColorLike) => {
                      const colorInstance = new Color(color);
                      const hex = colorInstance.hex();
                      if (isControlled && onChange) {
                        onChange(hex);
                      }
                    }}
                  >
                    <div className="aspect-square w-full rounded-md border">
                      <ColorPickerSelection className="h-full w-full" />
                    </div>
                    <div className="flex items-center gap-3">
                      <ColorPickerEyeDropper  />
                      <div className="grid w-full gap-1">
                        <ColorPickerHue  />
                        <ColorPickerAlpha />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ColorPickerFormat />
                    </div>
                  </ColorPicker>
                );
              } catch (error) {
                // Fallback if color parsing fails
                return (
                  <ColorPicker
                    className="max-w-xs rounded-md p-2"
                    defaultValue="#000000"
                    onChange={(color : ColorLike) => {
                      const colorInstance = new Color(color);
                      const hex = colorInstance.hex();
                      if (isControlled && onChange) {
                        onChange(hex);
                      }
                    }}
                  >
                    <div className="aspect-square w-full rounded-md border">
                      <ColorPickerSelection className="h-full w-full" />
                    </div>
                    <div className="flex items-center gap-3">
                      <ColorPickerEyeDropper  />
                      <div className="grid w-full gap-1">
                        <ColorPickerHue  />
                        <ColorPickerAlpha />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ColorPickerFormat />
                    </div>
                  </ColorPicker>
                );
              }
            })()}
          </PopoverContent>
        </Popover>
      ) : (
        <Input
          id={id}
          name={name}
          type={type}
          {...inputProps}
          placeholder={placeholder}
          required={required}
          min={min}
          max={max}
        />
      )}
    </FormField>
  );
}

export interface TextAreaFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  className?: string;
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  rows = 3,
  className = ""
}: TextAreaFieldProps) {
  return (
    <FormField id={id} label={label} required={required} className={`items-start ${className}`}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[80px]"
      />
    </FormField>
  );
}

export interface SelectFieldProps {
  id?: string;
  label: string;
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (value: string) => void;
  options: Array<{ value: string | number; label: string; disabled?: boolean; color?: string }>;
  placeholder?: string;
  required?: boolean;
  className?: string;
  multiple?: boolean;
  valueArray?: (string | number)[];
  defaultValueArray?: (string | number)[];
  onChangeArray?: (values: (string | number)[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function SelectField({
  id,
  label,
  name,
  value,
  defaultValue,
  onChange,
  options,
  placeholder = "Select...",
  required = false,
  className = "",
  multiple = false,
  valueArray,
  defaultValueArray,
  onChangeArray,
  searchable = false,
  searchPlaceholder = "Search..."
}: SelectFieldProps) {
  const isControlled = value !== undefined && onChange !== undefined;
  const selectProps = isControlled
    ? { value: String(value ?? ""), onValueChange: onChange }
    : { defaultValue: String(defaultValue ?? "") };

  // Handle multi-select case
  if (multiple) {
    const isArrayControlled = valueArray !== undefined && onChangeArray !== undefined;
    const selectedValues = isArrayControlled ? valueArray : (defaultValueArray || []);
    const selectedLabels = selectedValues.map(val =>
      options.find(opt => opt.value === val)?.label || String(val)
    ).join(", ") || placeholder;

    return (
      <FormField id={id} label={label} required={required} className={className}>
        <Select>
          <SelectTrigger id={id} aria-required={required} className="w-full">
            <SelectValue placeholder={selectedValues.length ? selectedLabels : placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={String(option.value)} disabled={option.disabled}>
                <div className="flex items-center gap-2">
                  {option.color && (
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Hidden inputs for form submission */}
        {selectedValues.map((val) => (
          <input key={val} type="hidden" name={name} value={String(val)} />
        ))}
      </FormField>
    );
  }

  const [searchTerm, setSearchTerm] = useState('');
  const filteredOptions = searchable
    ? options.filter((option) => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        return option.label.toLowerCase().includes(q) || String(option.value).toLowerCase().includes(q);
      })
    : options;

  return (
    <FormField id={id} label={label} required={required} className={className}>
      <Select {...selectProps}>
        <SelectTrigger id={id} name={name} aria-required={required} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {searchable && (
            <div className="p-2">
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8"
              />
            </div>
          )}
          {filteredOptions.map((option) => {
            const val = String(option.value);
            return (
              <SelectItem key={`${id}-${val}`} value={val} disabled={option.disabled}>
                <div className="flex items-center gap-2">
                  {option.color && (
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </FormField>
  );
}


export interface CheckboxFieldProps {
  id?: string;
  label: string;
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  description?: string;
  className?: string;
  disabled?: boolean;
  hideFieldLabel?: boolean;
}

export function CheckboxField({
  id,
  label,
  name,
  checked,
  defaultChecked,
  onChange,
  description,
  className = "",
  disabled = false,
  hideFieldLabel = false
}: CheckboxFieldProps) {
  const isControlled = checked !== undefined && onChange !== undefined;

  // For uncontrolled checkboxes, we need to sync with a hidden input for form submission
  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked || false);

  const handleUncontrolledChange = (checked: boolean) => {
    setUncontrolledChecked(checked);
  };

  return (
    <FormField id={id} label={label} className={className} hideLabel={hideFieldLabel}>
      <div className="flex items-center space-x-2">
        <Checkbox
          id={id}
          checked={isControlled ? checked : uncontrolledChecked}
          onCheckedChange={isControlled ? onChange : handleUncontrolledChange}
          disabled={disabled}
        />
        {/* Hidden input for form submission */}
        {name && (
          <input
            type="checkbox"
            name={name}
            checked={isControlled ? checked : uncontrolledChecked}
            onChange={() => {}} // Controlled by the Checkbox above
            style={{ display: 'none' }}
          />
        )}
        <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
          {description || label}
        </Label>
      </div>
    </FormField>
  );
}

export interface PreviewFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function PreviewField({ label, children, className = "" }: PreviewFieldProps) {
  return (
    <FormField label={label} className={className}>
      <div className="flex items-center space-x-3 p-2 border rounded">
        {children}
      </div>
    </FormField>
  );
}

// Common cell renderers for AG Grid
export function BadgeCellRenderer({ value, variant = "default", className = "" }: { value: any; variant?: "default" | "secondary" | "destructive" | "outline"; className?: string }) {
  if (!value) return null;
  return <Badge variant={variant} className={className}>{value}</Badge>;
}

export function BooleanBadgeCellRenderer({ value, trueText = "Yes", falseText = "No", trueVariant = "default", falseVariant = "secondary" }: { value: boolean; trueText?: string; falseText?: string; trueVariant?: "default" | "secondary" | "destructive" | "outline"; falseVariant?: "default" | "secondary" | "destructive" | "outline" }) {
  return (
    <Badge variant={value ? trueVariant : falseVariant}>
      {value ? trueText : falseText}
    </Badge>
  );
}

export function ColorIndicatorCellRenderer({ value, name, color }: { value: string; name?: string; color?: string }) {
  const displayColor = color || value;
  const displayName = name || value;
  
  return (
    <div className="flex items-center space-x-3 h-full">
      <div 
        className="w-6 h-6 min-w-[1.5rem] rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
        style={{ backgroundColor: displayColor }}
      >
        {displayName ? displayName.charAt(0).toUpperCase() : '?'}
      </div>
      <span className="truncate">{displayName}</span>
    </div>
  );
}

export function AvatarCellRenderer({ name, color, size = "md" }: { name: string; color?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-6 h-6 min-w-[1.5rem] text-xs",
    md: "w-8 h-8 min-w-[2rem] text-sm", 
    lg: "w-10 h-10 min-w-[2.5rem] text-base"
  };
  
  // Calculate text color based on background brightness
  const getTextColor = (bgColor: string): string => {
    if (!bgColor) return '#ffffff';
    try {
      // Handle both #RGB and #RRGGBB formats
      const hex = bgColor.length === 4
        ? `#${bgColor[1]}${bgColor[1]}${bgColor[2]}${bgColor[2]}${bgColor[3]}${bgColor[3]}`
        : bgColor;
      
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      return brightness > 180 ? '#111827' : '#ffffff';
    } catch {
      return '#ffffff';
    }
  };

  const backgroundColor = color || undefined;
  const textColor = color ? getTextColor(color) : undefined;
  
  return (
    <div className="flex items-center space-x-2">
      <div 
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-medium flex-shrink-0 ${!backgroundColor ? 'bg-primary text-primary-foreground' : ''}`}
        style={backgroundColor ? { backgroundColor, color: textColor } : undefined}
      >
        {name?.charAt(0)?.toUpperCase() || '?'}
      </div>
      <span className="truncate">{name}</span>
    </div>
  );
}

export default {
  FormField,
  TextField,
  TextAreaField,
  SelectField,
  CheckboxField,
  PreviewField,
  BadgeCellRenderer,
  BooleanBadgeCellRenderer,
  ColorIndicatorCellRenderer
};
