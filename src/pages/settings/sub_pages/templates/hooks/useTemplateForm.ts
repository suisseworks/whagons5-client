import { useState, useEffect, useMemo } from "react";
import { useDispatch } from "react-redux";
import { Template } from "@/store/types";
import { TemplateFormData } from "../types";
import { genericActions } from "@/store/genericSlices";

const initialFormData: TemplateFormData = {
  name: '',
  description: '',
  instructions: '',
  category_id: '',
  priority_id: '',
  sla_id: '',
  approval_id: '',
  form_id: '',
  default_spot_id: '',
  spots_not_applicable: false,
  expected_duration: '',
  enabled: true,
  is_private: false
};

export function useTemplateForm(
  editingTemplate: Template | null,
  isEditDialogOpen: boolean,
  priorities: any[],
  translate: (key: string, fallback: string) => string
) {
  const dispatch = useDispatch();
  const tt = (key: string, fallback: string) => translate(`validation.${key}`, fallback);

  const [createFormData, setCreateFormData] = useState<TemplateFormData>(initialFormData);
  const [editFormData, setEditFormData] = useState<TemplateFormData>(initialFormData);
  const [createDefaultUserValues, setCreateDefaultUserValues] = useState<string[]>([]);
  const [editDefaultUserValues, setEditDefaultUserValues] = useState<string[]>([]);
  const [selectedRequirement, setSelectedRequirement] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Category priorities filtering
  const createCategoryPriorities = useMemo(() => {
    if (!createFormData.category_id) return [];
    const categoryId = parseInt(createFormData.category_id);
    const categoryPriorities = priorities.filter((p: any) => p.category_id === categoryId);
    if (categoryPriorities.length === 0) {
      return priorities.filter((p: any) => p.category_id === null || p.category_id === undefined);
    }
    return categoryPriorities;
  }, [priorities, createFormData.category_id]);

  const editCategoryPriorities = useMemo(() => {
    if (!editFormData.category_id) return [];
    const categoryId = parseInt(editFormData.category_id);
    const categoryPriorities = priorities.filter((p: any) => p.category_id === categoryId);
    if (categoryPriorities.length === 0) {
      return priorities.filter((p: any) => p.category_id === null || p.category_id === undefined);
    }
    return categoryPriorities;
  }, [priorities, editFormData.category_id]);

  // Update edit form when template changes
  useEffect(() => {
    if (isEditDialogOpen && editingTemplate) {
      const ids = Array.isArray((editingTemplate as any).default_user_ids)
        ? (editingTemplate as any).default_user_ids.map((id: number) => String(id))
        : [];
      setEditDefaultUserValues(ids);

      const categoryId = editingTemplate.category_id;
      const priorityId = (editingTemplate as any).priority_id;
      let validPriorityId = priorityId?.toString() || '';
      
      if (categoryId && priorityId) {
        const categoryPriorities = priorities.filter((p: any) => p.category_id === categoryId);
        const isValidPriority = categoryPriorities.find((p: any) => p.id === priorityId);
        if (!isValidPriority) validPriorityId = '';
      }

      setEditFormData({
        name: editingTemplate.name || '',
        description: (editingTemplate as any).description || '',
        instructions: (editingTemplate as any).instructions || '',
        category_id: categoryId?.toString() || '',
        priority_id: validPriorityId,
        sla_id: (editingTemplate as any).sla_id?.toString() || '',
        approval_id: (editingTemplate as any).approval_id?.toString() || '',
        form_id: (editingTemplate as any).form_id != null ? String((editingTemplate as any).form_id) : '',
        default_spot_id: (editingTemplate as any).default_spot_id?.toString() || '',
        spots_not_applicable: (editingTemplate as any).spots_not_applicable === true,
        expected_duration: (editingTemplate as any).expected_duration != null ? String((editingTemplate as any).expected_duration) : '',
        enabled: (editingTemplate as any).enabled !== false,
        is_private: (editingTemplate as any).is_private === true
      });
    }
  }, [isEditDialogOpen, editingTemplate, priorities]);

  const resetCreateForm = () => {
    setCreateFormData(initialFormData);
    setCreateDefaultUserValues([]);
  };

  const resetEditForm = () => {
    setEditFormData(initialFormData);
    setEditDefaultUserValues([]);
  };

  const handleAddMapping = async (editingTemplate: Template | null) => {
    if (!selectedRequirement || !editingTemplate) return;
    try {
      await dispatch(genericActions.complianceMappings.addAsync({
        requirement_id: selectedRequirement,
        entity_type: 'template',
        entity_id: editingTemplate.id,
        justification: 'Mapped via Template Settings'
      }) as any);
      setSelectedRequirement('');
    } catch (error) {
      console.error('Failed to add mapping:', error);
    }
  };

  const handleRemoveMapping = async (mappingId: number) => {
    try {
      await dispatch(genericActions.complianceMappings.removeAsync(mappingId) as any);
    } catch (error) {
      console.error('Failed to remove mapping:', error);
    }
  };

  return {
    createFormData,
    setCreateFormData,
    editFormData,
    setEditFormData,
    createDefaultUserValues,
    setCreateDefaultUserValues,
    editDefaultUserValues,
    setEditDefaultUserValues,
    selectedRequirement,
    setSelectedRequirement,
    formError,
    setFormError,
    createCategoryPriorities,
    editCategoryPriorities,
    resetCreateForm,
    resetEditForm,
    handleAddMapping,
    handleRemoveMapping
  };
}
