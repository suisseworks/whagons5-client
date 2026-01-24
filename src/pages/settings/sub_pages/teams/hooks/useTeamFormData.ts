import { useState, useEffect } from "react";
import { Team } from "@/store/types";

export interface TeamFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
  parent_team_id: number | null;
  team_lead_id: number | null;
}

const defaultFormData: TeamFormData = {
  name: '',
  description: '',
  color: '#4ECDC4',
  icon: '',
  is_active: true,
  parent_team_id: null,
  team_lead_id: null
};

export function useTeamFormData(editingTeam: Team | null, isEditDialogOpen: boolean) {
  const [createFormData, setCreateFormData] = useState<TeamFormData>(defaultFormData);
  const [editFormData, setEditFormData] = useState<TeamFormData>(defaultFormData);

  useEffect(() => {
    if (editingTeam && isEditDialogOpen) {
      setEditFormData({
        name: editingTeam.name || '',
        description: editingTeam.description || '',
        color: editingTeam.color || '#4ECDC4',
        icon: editingTeam.icon ?? '',
        is_active: editingTeam.is_active ?? true,
        parent_team_id: editingTeam.parent_team_id ?? null,
        team_lead_id: editingTeam.team_lead_id ?? null
      });
    }
  }, [editingTeam, isEditDialogOpen]);

  const resetCreateForm = () => setCreateFormData(defaultFormData);
  const resetEditForm = () => setEditFormData(defaultFormData);

  return {
    createFormData,
    setCreateFormData,
    editFormData,
    setEditFormData,
    resetCreateForm,
    resetEditForm
  };
}
