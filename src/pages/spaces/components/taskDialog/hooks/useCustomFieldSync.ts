import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { updateTaskAsync } from '@/store/reducers/tasksSlice';
import { genericActions } from '@/store/genericSlices';
import { isCustomFieldValueFilled, serializeCustomFieldPayload } from '../utils/customFieldSerialization';

export function useCustomFieldSync(params: any) {
  const { categoryFields, customFieldValues, taskCustomFieldValues } = params;
  const dispatch = useDispatch<AppDispatch>();

  const syncTaskCustomFields = async (taskId: number) => {
    if (!taskId || categoryFields.length === 0) return;
    let didChange = false;
    const validFieldIds = new Set<number>();
    for (const { field } of categoryFields) {
      const fid = Number(field?.id);
      if (Number.isFinite(fid)) validFieldIds.add(fid);
    }

    const existingByField = new Map<number, any>();
    for (const row of taskCustomFieldValues || []) {
      const tId = Number(row?.task_id ?? row?.taskId);
      const fId = Number(row?.field_id ?? row?.custom_field_id ?? row?.fieldId);
      if (tId === Number(taskId) && Number.isFinite(fId)) {
        existingByField.set(fId, row);
      }
    }

    for (const [fieldId, row] of existingByField.entries()) {
      if (!validFieldIds.has(fieldId)) {
        await dispatch(genericActions.taskCustomFieldValues.removeAsync(row?.id ?? fieldId)).unwrap();
        didChange = true;
      }
    }

    for (const { field } of categoryFields) {
      const fieldId = Number(field?.id);
      if (!Number.isFinite(fieldId)) continue;

      const rawValue = customFieldValues[fieldId];
      const hasValue = isCustomFieldValueFilled(field, rawValue);
      const existing = existingByField.get(fieldId);

      if (!hasValue) {
        if (existing) {
          await dispatch(genericActions.taskCustomFieldValues.removeAsync(existing?.id ?? fieldId)).unwrap();
          didChange = true;
        }
        continue;
      }

      const payload = serializeCustomFieldPayload(field, rawValue);
      const body = {
        task_id: Number(taskId),
        field_id: fieldId,
        name: field?.name ?? '',
        type: String(field?.field_type ?? field?.type ?? '').toUpperCase(),
        ...payload,
      };

      if (existing) {
        await dispatch(genericActions.taskCustomFieldValues.updateAsync({ id: existing?.id, updates: body } as any)).unwrap();
        didChange = true;
      } else {
        await dispatch(genericActions.taskCustomFieldValues.addAsync(body as any)).unwrap();
        didChange = true;
      }
    }

    if (didChange) {
      try {
        await dispatch(updateTaskAsync({ id: taskId, updates: {} } as any)).unwrap();
      } catch (err) {
        console.warn('Failed to refresh task after custom field sync', err);
      }
    }
  };

  return { syncTaskCustomFields };
}
