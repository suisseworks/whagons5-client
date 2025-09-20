import { useMemo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  // Safely destructure with default values
  const workspacesState = useSelector((s: RootState) => s.workspaces);
  const teamsState = useSelector((s: RootState) => s.teams);
  const categoriesState = useSelector((s: RootState) => s.categories);
  const templatesState = useSelector((s: RootState) => s.templates);
  const tasksState = useSelector((s: RootState) => s.tasks);

  const { value: workspaces = [] } = workspacesState || {};
  const { value: teams = [] } = teamsState || {};
  const { value: categories = [] } = categoriesState || {};
  const { value: templates = [] } = templatesState || {};
  const { value: tasks = [] } = tasksState || {};

  // Data is hydrated globally in AuthProvider; no fetching here

  const topWorkspaces = useMemo(() => workspaces.slice(0, 6), [workspaces]);

  return (
    <div className="p-6 space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome</h1>
          <p className="text-muted-foreground">Select a workspace to get started, or explore your stats below.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/analytics')}>View Analytics</Button>
          <Button onClick={() => navigate('/settings')}>Open Settings</Button>
        </div>
      </div>

      <Separator />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Workspaces</CardTitle>
            <CardDescription>Total available</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{workspaces.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Teams</CardTitle>
            <CardDescription>Across your org</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teams.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>For organizing tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>Reusable workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks overview */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks Overview</CardTitle>
          <CardDescription>Current total across all workspaces</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{tasks.length}</div>
        </CardContent>
      </Card>

      {/* Recent Workspaces */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Workspaces</CardTitle>
          <CardDescription>Jump back in</CardDescription>
        </CardHeader>
        <CardContent>
          {topWorkspaces.length === 0 ? (
            <div className="text-muted-foreground">No workspaces yet. Create one from Settings → Workspaces.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topWorkspaces.map((ws: any) => (
                <button
                  key={ws.id}
                  onClick={() => navigate(`/workspace/${ws.id}`)}
                  className="p-4 border rounded-md text-left hover:bg-accent transition-colors"
                >
                  <div className="text-base font-medium truncate">{ws.name}</div>
                  <div className="text-sm text-muted-foreground truncate">{ws.description}</div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Home;


