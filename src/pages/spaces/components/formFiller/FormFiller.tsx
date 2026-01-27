/**
 * FormFiller - Renders a form schema for user input
 * 
 * This component takes a form schema (from FormVersion.fields) and renders
 * each field for user input. It manages form values and notifies the parent
 * of changes through the onChange callback.
 */

import { useMemo } from 'react';
import { ShortAnswerField } from '@/pages/settings/sub_pages/forms/components/field-types/ShortAnswerField';
import { ParagraphField } from '@/pages/settings/sub_pages/forms/components/field-types/ParagraphField';
import { MultipleChoiceField } from '@/pages/settings/sub_pages/forms/components/field-types/MultipleChoiceField';
import { CheckboxField } from '@/pages/settings/sub_pages/forms/components/field-types/CheckboxField';
import { DateField } from '@/pages/settings/sub_pages/forms/components/field-types/DateField';
import { TimeField } from '@/pages/settings/sub_pages/forms/components/field-types/TimeField';
import { DateTimeField } from '@/pages/settings/sub_pages/forms/components/field-types/DateTimeField';
import { NumberField } from '@/pages/settings/sub_pages/forms/components/field-types/NumberField';
import { SignatureField } from '@/pages/settings/sub_pages/forms/components/field-types/SignatureField';
import { ImageField } from '@/pages/settings/sub_pages/forms/components/field-types/ImageField';
import { FixedImageField } from '@/pages/settings/sub_pages/forms/components/field-types/FixedImageField';

export interface FormField {
  id: number;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date' | 'number' | 'time' | 'datetime' | 'signature' | 'image' | 'fixed-image';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  properties?: {
    imageUrl?: string | null;
    imageId?: string | null;
    allowDecimals?: boolean;
    [key: string]: any;
  };
}

export interface FormSchema {
  title?: string;
  description?: string;
  fields: FormField[];
}

export interface FormFillerProps {
  schema: FormSchema;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  readOnly?: boolean;
  showValidation?: boolean;
}

export function FormFiller({
  schema,
  values,
  onChange,
  readOnly = false,
  showValidation = false,
}: FormFillerProps) {
  // Helper to update a single field value
  const handleFieldChange = (fieldId: number, value: any) => {
    onChange({
      ...values,
      [fieldId]: value,
    });
  };

  // Check if a required field is empty
  const isFieldEmpty = (field: FormField): boolean => {
    const value = values[field.id];
    if (value === undefined || value === null || value === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  };

  // Get validation errors for display
  const validationErrors = useMemo(() => {
    if (!showValidation) return {};
    const errors: Record<number, string> = {};
    for (const field of schema.fields) {
      if (field.required && isFieldEmpty(field)) {
        errors[field.id] = 'This field is required';
      }
    }
    return errors;
  }, [schema.fields, values, showValidation]);

  const renderField = (field: FormField) => {
    const fieldValue = values[field.id];
    const error = validationErrors[field.id];

    // Common wrapper for all fields
    const fieldWrapper = (children: React.ReactNode) => (
      <div key={field.id} className="space-y-2">
        <div className="text-sm font-medium">
          {field.label || 'Untitled question'}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </div>
        {children}
        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}
      </div>
    );

    switch (field.type) {
      case 'text':
        return fieldWrapper(
          <ShortAnswerField
            isEditing={false}
            value={fieldValue || ''}
            onChange={readOnly ? undefined : (val) => handleFieldChange(field.id, val)}
          />
        );

      case 'textarea':
        return fieldWrapper(
          <ParagraphField
            isEditing={false}
            value={fieldValue || ''}
            onChange={readOnly ? undefined : (val) => handleFieldChange(field.id, val)}
          />
        );

      case 'select':
        return fieldWrapper(
          <MultipleChoiceField
            options={field.options || []}
            onOptionsChange={() => {}} // Not used in fill mode
            isEditing={false}
            value={fieldValue || ''}
            onChange={readOnly ? undefined : (val) => handleFieldChange(field.id, val)}
          />
        );

      case 'checkbox':
        return fieldWrapper(
          <CheckboxField
            options={field.options || []}
            onOptionsChange={() => {}} // Not used in fill mode
            isEditing={false}
            value={fieldValue || []}
            onChange={readOnly ? undefined : (val) => handleFieldChange(field.id, val)}
          />
        );

      case 'date':
        return fieldWrapper(
          <DateField
            isEditing={false}
            value={fieldValue || ''}
            onChange={readOnly ? undefined : (val) => handleFieldChange(field.id, val)}
          />
        );

      case 'time':
        return fieldWrapper(
          <TimeField
            isEditing={false}
            value={fieldValue || ''}
            onChange={readOnly ? undefined : (val) => handleFieldChange(field.id, val)}
          />
        );

      case 'datetime':
        return fieldWrapper(
          <DateTimeField
            isEditing={false}
            value={fieldValue || ''}
            onChange={readOnly ? undefined : (val) => handleFieldChange(field.id, val)}
          />
        );

      case 'number':
        return fieldWrapper(
          <NumberField
            isEditing={false}
            value={fieldValue ?? 0}
            onChange={readOnly ? undefined : (val) => handleFieldChange(field.id, val)}
            allowDecimals={field.properties?.allowDecimals}
          />
        );

      case 'signature':
        return fieldWrapper(
          <SignatureField
            isEditing={false}
            value={fieldValue || null}
            onChange={readOnly ? undefined : (val) => handleFieldChange(field.id, val)}
          />
        );

      case 'image':
        return fieldWrapper(
          <ImageField
            isEditing={false}
            value={fieldValue || null}
            onChange={readOnly ? undefined : (val) => handleFieldChange(field.id, val)}
          />
        );

      case 'fixed-image':
        // Fixed image is display-only, no user input
        return fieldWrapper(
          <FixedImageField
            isEditing={false}
            imageUrl={field.properties?.imageUrl}
            imageId={field.properties?.imageId}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Form Header */}
      {(schema.title || schema.description) && (
        <div className="space-y-2 pb-4 border-b">
          {schema.title && (
            <h2 className="text-xl font-semibold">{schema.title}</h2>
          )}
          {schema.description && (
            <p className="text-muted-foreground">{schema.description}</p>
          )}
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-6">
        {schema.fields.map(renderField)}
      </div>

      {/* Empty state */}
      {schema.fields.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No fields in this form
        </div>
      )}
    </div>
  );
}

/**
 * Utility function to validate form data against schema
 * Returns array of field IDs with validation errors
 */
export function validateFormData(
  schema: FormSchema,
  values: Record<string, any>
): number[] {
  const errors: number[] = [];
  
  for (const field of schema.fields) {
    if (field.required) {
      const value = values[field.id];
      const isEmpty = 
        value === undefined || 
        value === null || 
        value === '' ||
        (Array.isArray(value) && value.length === 0);
      
      if (isEmpty) {
        errors.push(field.id);
      }
    }
  }
  
  return errors;
}

export default FormFiller;
