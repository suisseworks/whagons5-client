import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RootState } from "@/store/store";
import { Category, Team } from "@/store/types";
import api from "@/api/whagonsApi";

export interface CategoryReportingTeamsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}

export function CategoryReportingTeamsManager({ open, onOpenChange, category }: CategoryReportingTeamsManagerProps) {
  const { value: teams } = useSelector((state: RootState) => state.teams) as { value: Team[] };
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current reporting teams when dialog opens
  useEffect(() => {
    if (open && category) {
      loadReportingTeams();
    }
  }, [open, category]);

  const loadReportingTeams = async () => {
    if (!category) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/categories/${category.id}/reporting-teams`);
      const reportingTeams = response.data?.data || [];
      setSelectedTeamIds(reportingTeams.map((team: Team) => team.id));
    } catch (e: any) {
      console.error('Error loading reporting teams', e);
      setError(e?.response?.data?.message || 'Failed to load reporting teams');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTeam = (teamId: number) => {
    setSelectedTeamIds(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        return [...prev, teamId];
      }
    });
  };

  const handleSave = async () => {
    if (!category) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/categories/${category.id}/reporting-teams`, {
        team_ids: selectedTeamIds
      });
      onOpenChange(false);
      // Refresh categories to update reporting_teams field
      window.location.reload(); // Simple refresh - could be improved with Redux dispatch
    } catch (e: any) {
      console.error('Error saving reporting teams', e);
      setError(e?.response?.data?.message || 'Failed to save reporting teams');
    } finally {
      setSaving(false);
    }
  };

  const closeDialog = () => {
    onOpenChange(false);
    setError(null);
  };

  // Filter out the category's owner team from the list
  const availableTeams = teams.filter(team => team.id !== category?.team_id);

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Reporting Teams{category ? ` • ${category.name}` : ''}</DialogTitle>
          <DialogDescription>
            Select teams that can report/create tasks for this category. The category owner team always has permission.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {availableTeams.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center">
                <div className="text-sm text-muted-foreground">No other teams available.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {availableTeams.map((team) => (
                  <div key={team.id} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50">
                    <Checkbox
                      id={`team-${team.id}`}
                      checked={selectedTeamIds.includes(team.id)}
                      onCheckedChange={() => handleToggleTeam(team.id)}
                    />
                    <Label
                      htmlFor={`team-${team.id}`}
                      className="flex-1 cursor-pointer flex items-center space-x-2"
                    >
                      <div
                        className="w-6 h-6 min-w-[1.5rem] text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                        style={{ backgroundColor: team.color || '#6B7280' }}
                      >
                        {team.name ? team.name.charAt(0).toUpperCase() : 'T'}
                      </div>
                      <span>{team.name}</span>
                    </Label>
                  </div>
                ))}
              </div>
            )}
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CategoryReportingTeamsManager;


