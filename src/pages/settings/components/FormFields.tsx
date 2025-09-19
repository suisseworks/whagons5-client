import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export interface FormFieldProps {
  id?: string;
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ id, label, required = false, className = "", children }: FormFieldProps) {
  return (
    <div className={`grid grid-cols-4 items-center gap-4 ${className}`}>
      <Label htmlFor={id} className="text-right">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="col-span-3">
        {children}
      </div>
    </div>
  );
}

export interface TextFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
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
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  min,
  max,
  className = ""
}: TextFieldProps) {
  return (
    <FormField id={id} label={label} required={required} className={className}>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
      />
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
    <FormField id={id} label={label} required={required} className="items-start">
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[80px]"
      />
    </FormField>
  );
}

export interface SelectFieldProps {
  id?: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: Array<{ value: string | number; label: string; disabled?: boolean }>;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  required = false,
  className = ""
}: SelectFieldProps) {
  return (
    <FormField id={id} label={label} required={required} className={className}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

export interface CheckboxFieldProps {
  id?: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  className?: string;
}

export function CheckboxField({
  id,
  label,
  checked,
  onChange,
  description,
  className = ""
}: CheckboxFieldProps) {
  return (
    <FormField id={id} label={label} className={className}>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded"
        />
        <Label htmlFor={id} className="text-sm">
          {checked ? 'Enabled' : 'Disabled'}
        </Label>
        {description && (
          <span className="text-xs text-muted-foreground ml-2">{description}</span>
        )}
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

export function AvatarCellRenderer({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-6 h-6 min-w-[1.5rem] text-xs",
    md: "w-8 h-8 min-w-[2rem] text-sm", 
    lg: "w-10 h-10 min-w-[2.5rem] text-base"
  };
  
  return (
    <div className="flex items-center space-x-2">
      <div className={`${sizeClasses[size]} bg-primary text-primary-foreground rounded-full flex items-center justify-center font-medium flex-shrink-0`}>
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
