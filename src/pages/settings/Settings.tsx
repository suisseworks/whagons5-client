 
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faTags, 
  faClipboardList, 
  faLocationDot, 
  faUsers, 
  faUser, 
  faSitemap 
} from "@fortawesome/free-solid-svg-icons";
import { RootState, AppDispatch } from "@/store/store";
import api from "@/api/whagonsApi";
import { useState } from "react";

function Settings() {
  const navigate = useNavigate();
  const [spotCount, setSpotCount] = useState<number | undefined>(undefined);

  // Hydrate data (idempotent if already loaded)


  // Fetch authoritative spot count from backend
  useEffect(() => {
    let cancelled = false;
    const fetchSpotCount = async () => {
      // 1) Try integrity blocks API (most reliable and cheap for totals)
      try {
        for (const table of ['wh_spots']) {
          try {
            const r = await api.get('/integrity/blocks', { params: { table } });
            const blocks = r?.data?.data || [];
            if (Array.isArray(blocks) && blocks.length) {
              const total = blocks.reduce((sum: number, b: any) => sum + (b?.row_count || 0), 0);
              if (!cancelled && total > 0) { setSpotCount(total); return; }
            }
          } catch (_) { /* try next table name */ }
        }
      } catch (_) { /* fall through to REST fallback */ }

      // 2) Fallback to REST list endpoint and rely on pagination.total if available
      try {
        const resp = await api.get('/spots', { params: { page: 1, per_page: 1 } });
        const total = resp?.data?.pagination?.total
          ?? resp?.data?.total
          ?? resp?.data?.meta?.total
          ?? (resp?.headers && (parseInt((resp.headers as any)['x-total-count']) || undefined));
        if (!cancelled && typeof total === 'number') { setSpotCount(total); return; }
      } catch (_) { /* ignore; will fallback to client-side derivations */ }

      // 3) Final fallback: request a large page and count rows directly
      try {
        const resp = await api.get('/spots', { params: { page: 1, per_page: 1000 } });
        const rows = Array.isArray(resp?.data?.data)
          ? resp.data.data
          : (Array.isArray(resp?.data?.rows) ? resp.data.rows : []);
        if (!cancelled && Array.isArray(rows)) { setSpotCount(rows.length); return; }
      } catch (_) { /* last resort: keep derived value */ }
    };
    fetchSpotCount();
    return () => { cancelled = true; };
  }, []);

  // Select from store
  const categories = useSelector((s: RootState) => s.categories.value);
  const templates = useSelector((s: RootState) => s.templates.value);
  const teams = useSelector((s: RootState) => s.teams.value);
  const tasks = useSelector((s: RootState) => s.tasks.value);
  const workspaces = useSelector((s: RootState) => s.workspaces.value);
  const statuses = useSelector((s: RootState) => s.statuses.value);

  const counts = useMemo(() => {
    // Prefer authoritative count from workspaces.spots when present. The API may
    // return spots either as an array or as a JSON-encoded string – handle both.
    const spotsFromWorkspaces = workspaces.reduce((sum: number, w: any) => {
      let length = 0;
      const spotsVal = w?.spots;
      if (Array.isArray(spotsVal)) {
        length = spotsVal.length;
      } else if (typeof spotsVal === 'string') {
        try {
          const parsed = JSON.parse(spotsVal);
          if (Array.isArray(parsed)) length = parsed.length;
        } catch { /* ignore parse errors */ }
      }
      return sum + length;
    }, 0);

    let spotsFromTasks = 0;
    if (spotsFromWorkspaces === 0) {
      const spotIds = new Set<number>();
      for (const t of tasks) {
        if (t.spot_id && t.spot_id > 0) spotIds.add(t.spot_id);
      }
      spotsFromTasks = spotIds.size;
    }

    return {
      categories: categories.length,
      templates: templates.length,
      teams: teams.length,
      spots: spotCount ?? (spotsFromWorkspaces > 0 ? spotsFromWorkspaces : spotsFromTasks),
      statuses: statuses.length,
      users: undefined as number | undefined,
    };
  }, [categories.length, templates.length, teams.length, tasks, workspaces, spotCount, statuses.length]);

  // Settings configuration data
  const settingsOptions = [
    {
      id: 'categories',
      title: 'Categories',
      icon: faTags,
      count: counts.categories,
      description: 'Manage task categories and labels',
      color: 'text-red-500'
    },
    {
      id: 'statuses',
      title: 'Statuses',
      icon: faSitemap,
      count: counts.statuses,
      description: 'Manage statuses and transitions',
      color: 'text-amber-500'
    },
    {
      id: 'templates',
      title: 'Templates',
      icon: faClipboardList,
      count: counts.templates,
      description: 'Manage task templates and standardized workflows',
      color: 'text-blue-500'
    },
    {
      id: 'spots',
      title: 'Spots',
      icon: faLocationDot,
      count: counts.spots,
      description: 'Set up locations and spot management',
      color: 'text-green-500'
    },
    {
      id: 'teams',
      title: 'Teams',
      icon: faUsers,
      count: counts.teams,
      description: 'Organize and manage work teams',
      color: 'text-purple-500'
    },
    {
      id: 'users',
      title: 'Users',
      icon: faUser,
      count: counts.users,
      description: 'User accounts and permissions',
      color: 'text-indigo-500'
    }
  ];

  const handleSettingClick = (settingId: string) => {
    console.log(`Clicked on ${settingId}`);
    
    // Navigate to specific setting pages
    switch (settingId) {
      case 'categories':
        navigate('/settings/categories');
        break;
      case 'templates':
        navigate('/settings/templates');
        break;
      case 'statuses':
        navigate('/settings/statuses');
        break;
      case 'spots':
        navigate('/settings/spots');
        break;
      case 'teams':
        navigate('/settings/teams');
        break;
      case 'users':
        navigate('/settings/users');
        break;
      default:
        console.log(`Unknown setting: ${settingId}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your application settings and configurations
          </p>
        </div>
      </div>

      <Separator />

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {settingsOptions.map((setting) => (
          <Card
            key={setting.id}
            className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] group"
            onClick={() => handleSettingClick(setting.id)}
          >
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div className={`text-4xl ${setting.color} group-hover:scale-110 transition-transform duration-200`}>
                  <FontAwesomeIcon icon={setting.icon} />
                </div>
                {setting.count !== undefined && (
                  <Badge variant="secondary" className="font-bold">
                    {setting.count}
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                <CardTitle className="text-xl">{setting.title}</CardTitle>
                <CardDescription>{setting.description}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      

      
       
    </div>
  );
}

export default Settings;