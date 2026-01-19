# TaskDialog Refactor Structure

**Goal**: Reduce TaskDialog.tsx from 2100 lines to ~300 lines by extracting logic into modules.

## Folder Structure

```
taskDialog/
├── hooks/
│   ├── useDialogResize.ts          ✅ DONE - Resize logic (100 lines)
│   ├── useTaskForm.ts              ⚠️  TODO - Form state management
│   ├── useCustomFields.ts          ⚠️  TODO - Custom field logic
│   └── useTaskSubmit.ts            ⚠️  TODO - Submit/validation logic
├── components/
│   ├── CustomFieldInput.tsx        ✅ DONE - Field rendering (150 lines)
│   ├── BasicTab.tsx                ⚠️  TODO - Template, name, description, etc
│   ├── CustomFieldsTab.tsx         ⚠️  TODO - Custom fields tab
│   ├── AdditionalTab.tsx           ⚠️  TODO - Tags, SLA, approval
│   └── ShareTab.tsx                ⚠️  TODO - Sharing functionality
├── utils/
│   ├── fieldHelpers.ts             ✅ DONE - Field parsing utilities
│   ├── customFieldSerialization.ts ✅ DONE - Serialize/deserialize
│   └── workspaceHelpers.ts         ⚠️  TODO - Workspace derivation logic
└── README.md                        ✅ THIS FILE

TaskDialog.tsx                       ⚠️  TODO - Main component (~300 lines)
```

## What Each Module Should Contain

### hooks/useTaskForm.ts
```typescript
export function useTaskForm(mode, task, workspaceId) {
  // All form state: name, description, categoryId, priorityId, etc
  // Returns: { formState, setters, resetForm }
}
```

### hooks/useCustomFields.ts  
```typescript
export function useCustomFields(categoryId, task, mode) {
  // Custom field state and sync logic
  // Returns: { customFieldValues, handleChange, syncToServer }
}
```

### hooks/useTaskSubmit.ts
```typescript
export function useTaskSubmit(mode, formState, customFieldValues) {
  // Validation and submit logic
  // Returns: { handleSubmit, isSubmitting, canSubmit }
}
```

### components/BasicTab.tsx
- Template selection
- Name/Description
- Location
- Responsible users
- Priority

### components/CustomFieldsTab.tsx
- Render all custom fields for category
- Use CustomFieldInput component
- Show required field indicators

### components/AdditionalTab.tsx
- Tags (create & edit modes only)
- SLA selection
- Approval selection  
- Due date

### components/ShareTab.tsx
- TaskShareManager component
- Share to user/team controls
- Permission selection

## Migration Steps

1. ✅ Extract resize logic → useDialogResize
2. ✅ Extract field rendering → CustomFieldInput
3. ✅ Extract field utilities → fieldHelpers + customFieldSerialization
4. ⚠️  Extract form state → useTaskForm
5. ⚠️  Extract custom field logic → useCustomFields
6. ⚠️  Extract submit logic → useTaskSubmit
7. ⚠️  Create tab components
8. ⚠️  Simplify main TaskDialog.tsx

## Expected Final TaskDialog.tsx (~300 lines)

```typescript
import { useDialogResize } from './taskDialog/hooks/useDialogResize';
import { useTaskForm } from './taskDialog/hooks/useTaskForm';
import { useCustomFields } from './taskDialog/hooks/useCustomFields';
import { useTaskSubmit } from './taskDialog/hooks/useTaskSubmit';
import { BasicTab, CustomFieldsTab, AdditionalTab, ShareTab } from './taskDialog/components';

export default function TaskDialog({ open, onOpenChange, mode, workspaceId, task }) {
  const { width, isResizing, resizeRef, sheetContentRef, handleResizeStart, MIN_WIDTH } = useDialogResize(open);
  const formState = useTaskForm(mode, task, workspaceId);
  const customFields = useCustomFields(formState.categoryId, task, mode);
  const { handleSubmit, isSubmitting, canSubmit } = useTaskSubmit(mode, formState, customFields);

  const [activeTab, setActiveTab] = useState('basic');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent ref={sheetContentRef} style={...} className={...}>
        {/* Resize Handle */}
        <div ref={resizeRef} onMouseDown={handleResizeStart} {...} />
        
        {/* Header */}
        <SheetHeader>
          <SheetTitle>{mode === 'edit' ? 'Edit Task' : 'Create New Task'}</SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="basic">Basic Details</TabsTrigger>
            {customFields.categoryFields.length > 0 && (
              <TabsTrigger value="customFields">Fields</TabsTrigger>
            )}
            <TabsTrigger value="additional">Additional Info</TabsTrigger>
            {mode === 'edit' && <TabsTrigger value="share">Share</TabsTrigger>}
          </TabsList>

          <TabsContent value="basic">
            <BasicTab formState={formState} mode={mode} />
          </TabsContent>

          <TabsContent value="customFields">
            <CustomFieldsTab customFields={customFields} />
          </TabsContent>

          <TabsContent value="additional">
            <AdditionalTab formState={formState} mode={mode} />
          </TabsContent>

          {mode === 'edit' && (
            <TabsContent value="share">
              <ShareTab task={task} />
            </TabsContent>
          )}
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? (mode === 'edit' ? 'Saving...' : 'Creating...') : (mode === 'edit' ? 'Save Changes' : 'Create Task')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

## Benefits

- ✅ Main component reduced from 2100 → ~300 lines
- ✅ Logic is testable in isolation
- ✅ Easier to debug specific functionality
- ✅ Better code organization
- ✅ Reusable hooks and components
- ✅ No more "wtf" moments

## Next Steps

Continue extracting remaining pieces. The hard parts (resize, field rendering, serialization) are done!
