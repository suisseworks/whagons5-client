/**
 * FormFillDialog - Dialog for filling forms associated with tasks
 * 
 * This dialog is opened from the workspace table when a user clicks on
 * a form column. It loads the form schema and any existing submission,
 * allows the user to fill/edit the form, and saves to the task-forms API.
 */

import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormFiller, validateFormData, FormSchema } from '../formFiller';
import { genericActions } from '@/store/genericSlices';
import { AppDispatch, RootState } from '@/store/store';
import { Loader2 } from 'lucide-react';

export interface FormFillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: number;
  taskName?: string;
  formId: number;
  formVersionId: number;
  existingTaskFormId?: number;
  existingData?: Record<string, any>;
}

export function FormFillDialog({
  open,
  onOpenChange,
  taskId,
  taskName,
  formId,
  formVersionId,
  existingTaskFormId,
  existingData,
}: FormFillDialogProps) {
  const dispatch = useDispatch<AppDispatch>();
  
  // Get form versions from Redux store
  const { value: formVersions } = useSelector((state: RootState) => (state as any).formVersions || { value: [] });
  const { value: forms } = useSelector((state: RootState) => (state as any).forms || { value: [] });
  
  // Local state
  const [values, setValues] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the form version schema
  const formVersion = useMemo(() => {
    return formVersions.find((v: any) => v.id === formVersionId);
  }, [formVersions, formVersionId]);

  // Get the form name
  const form = useMemo(() => {
    return forms.find((f: any) => f.id === formId);
  }, [forms, formId]);

  // Parse the schema from form version
  const schema: FormSchema = useMemo(() => {
    if (!formVersion?.fields) {
      return { title: '', description: '', fields: [] };
    }
    
    const fieldsData = typeof formVersion.fields === 'string' 
      ? JSON.parse(formVersion.fields) 
      : formVersion.fields;
    
    return {
      title: fieldsData?.title || form?.name || '',
      description: fieldsData?.description || '',
      fields: fieldsData?.fields || [],
    };
  }, [formVersion, form]);

  // Initialize values when dialog opens
  useEffect(() => {
    if (open) {
      // Reset state
      setShowValidation(false);
      setError(null);
      
      // Load existing data or start fresh
      if (existingData) {
        // Parse if it's a string
        const data = typeof existingData === 'string' 
          ? JSON.parse(existingData) 
          : existingData;
        setValues(data || {});
      } else {
        setValues({});
      }
    }
  }, [open, existingData]);

  // Validate and submit the form
  const handleSubmit = async () => {
    // Validate required fields
    const validationErrors = validateFormData(schema, values);
    if (validationErrors.length > 0) {
      setShowValidation(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (existingTaskFormId) {
        // Update existing task form
        await dispatch(genericActions.taskForms.updateAsync({
          id: existingTaskFormId,
          updates: { data: values }
        })).unwrap();
      } else {
        // Create new task form
        await dispatch(genericActions.taskForms.addAsync({
          task_id: taskId,
          form_version_id: formVersionId,
          data: values,
        })).unwrap();
      }

      // Close dialog on success
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving form:', err);
      setError(err?.message || 'Failed to save form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle dialog close
  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <span>{schema.title || 'Fill Form'}</span>
            {taskName && (
              <span className="text-sm font-normal text-muted-foreground">
                Task: {taskName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {!formVersion ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading form...</span>
            </div>
          ) : schema.fields.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              This form has no fields
            </div>
          ) : (
            <FormFiller
              schema={schema}
              values={values}
              onChange={setValues}
              showValidation={showValidation}
            />
          )}
        </div>

        {error && (
          <div className="text-sm text-destructive px-1 pb-2">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formVersion || schema.fields.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : existingTaskFormId ? (
              'Update'
            ) : (
              'Submit'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FormFillDialog;
