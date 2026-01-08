import React, { useState, useEffect, useCallback } from "react";
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  category: Category | null;
  // Inline mode props (when used inline, these override internal state)
  variant?: 'dialog' | 'inline';
  selectedTeamIds?: number[];
  onToggleTeam?: (teamId: number) => void;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  onSave?: () => Promise<void>;
  onLoad?: () => Promise<void>;
  onReset?: () => void;
  teams?: Team[];
}

export function CategoryReportingTeamsManager({ 
  open, 
  onOpenChange, 
  category,
  variant = 'dialog',
  selectedTeamIds: controlledSelectedTeamIds,
  onToggleTeam: controlledOnToggleTeam,
  loading: controlledLoading,
  saving: controlledSaving,
  error: controlledError,
  onSave: controlledOnSave,
  onLoad: controlledOnLoad,
  onReset: controlledOnReset,
  teams: controlledTeams
}: CategoryReportingTeamsManagerProps) {
  const teamsFromStore = useSelector((state: RootState) => (state.teams as { value: Team[] }).value);
  const teams = controlledTeams || teamsFromStore;
  
  // Internal state (only used in dialog mode)
  const [internalSelectedTeamIds, setInternalSelectedTeamIds] = useState<number[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalSaving, setInternalSaving] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Use controlled props if provided, otherwise use internal state
  const selectedTeamIds = controlledSelectedTeamIds ?? internalSelectedTeamIds;
  const loading = controlledLoading ?? internalLoading;
  const saving = controlledSaving ?? internalSaving;
  const error = controlledError ?? internalError;

  const loadReportingTeams = useCallback(async () => {
    if (!category) return;
    if (controlledOnLoad) {
      await controlledOnLoad();
      return;
    }
    setInternalLoading(true);
    setInternalError(null);
    try {
      const response = await api.get(`/categories/${category.id}/reporting-teams`);
      const reportingTeams = response.data?.data || [];
      setInternalSelectedTeamIds(reportingTeams.map((team: Team) => team.id));
    } catch (e: any) {
      console.error('Error loading reporting teams', e);
      setInternalError(e?.response?.data?.message || 'Failed to load reporting teams');
    } finally {
      setInternalLoading(false);
    }
  }, [category, controlledOnLoad]);

  // Load current reporting teams when dialog opens (only in dialog mode)
  useEffect(() => {
    if (variant === 'dialog' && open && category && controlledOnLoad === undefined) {
      loadReportingTeams();
    }
  }, [variant, open, category, controlledOnLoad, loadReportingTeams]);

  const handleToggleTeam = (teamId: number) => {
    if (controlledOnToggleTeam) {
      controlledOnToggleTeam(teamId);
      return;
    }
    setInternalSelectedTeamIds(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        return [...prev, teamId];
      }
    });
  };

  const handleSave = async () => {
    if (!category) return;
    if (controlledOnSave) {
      await controlledOnSave();
      return;
    }
    setInternalSaving(true);
    setInternalError(null);
    try {
      await api.patch(`/categories/${category.id}/reporting-teams`, {
        team_ids: internalSelectedTeamIds
      });
      if (onOpenChange) {
        onOpenChange(false);
      }
      // Refresh categories to update reporting_teams field
      window.location.reload(); // Simple refresh - could be improved with Redux dispatch
    } catch (e: any) {
      console.error('Error saving reporting teams', e);
      setInternalError(e?.response?.data?.message || 'Failed to save reporting teams');
    } finally {
      setInternalSaving(false);
    }
  };

  const handleReset = () => {
    if (controlledOnReset) {
      controlledOnReset();
      return;
    }
    if (variant === 'dialog' && category) {
      loadReportingTeams();
    }
  };

  const closeDialog = () => {
    if (onOpenChange) {
      onOpenChange(false);
    }
    setInternalError(null);
  };

  // Filter out the category's owner team from the list
  const availableTeams = teams.filter(team => team.id !== category?.team_id);

  // Render content (shared between dialog and inline modes)
  const renderContent = () => (
    <>
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
    </>
  );

  // Render footer buttons (shared between dialog and inline modes)
  const renderFooter = () => (
    <div className="flex justify-end gap-2 pt-4 border-t">
      {variant === 'inline' && controlledOnReset && (
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={saving || loading}
        >
          Reset
        </Button>
      )}
      {variant === 'dialog' && (
        <Button variant="outline" onClick={closeDialog} disabled={saving}>
          Cancel
        </Button>
      )}
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
    </div>
  );

  // Inline mode: render content directly
  if (variant === 'inline') {
    return (
      <div className="min-h-[320px] space-y-4">
        {category ? (
          <>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Reporting Teams</h3>
              <p className="text-xs text-muted-foreground">
                Select teams that can report/create tasks for this category. The category owner team always has permission.
              </p>
            </div>
            {renderContent()}
            {renderFooter()}
          </>
        ) : (
          <div className="flex items-center justify-center h-[320px] text-muted-foreground">
            No category selected
          </div>
        )}
      </div>
    );
  }

  // Dialog mode: render with Dialog wrapper
  return (
    <Dialog open={open ?? false} onOpenChange={closeDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Reporting Teams{category ? ` • ${category.name}` : ''}</DialogTitle>
          <DialogDescription>
            Select teams that can report/create tasks for this category. The category owner team always has permission.
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
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


