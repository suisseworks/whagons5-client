 
import { useNavigate } from "react-router-dom";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faTags, 
  faClipboardList, 
  faLocationDot, 
  faUsers, 
  faUser 
} from "@fortawesome/free-solid-svg-icons";

function Settings() {
  const navigate = useNavigate();
  
  // Settings configuration data
  const settingsOptions = [
    {
      id: 'categories',
      title: 'Categories',
      icon: faTags,
      count: 12,
      description: 'Manage task categories and labels',
      color: 'text-red-500'
    },
    {
      id: 'templates',
      title: 'Templates',
      icon: faClipboardList,
      count: 148,
      description: 'Manage task templates and standardized workflows',
      color: 'text-blue-500'
    },
    {
      id: 'spots',
      title: 'Spots',
      icon: faLocationDot,
      count: 48,
      description: 'Set up locations and spot management',
      color: 'text-green-500'
    },
    {
      id: 'teams',
      title: 'Teams',
      icon: faUsers,
      count: 8,
      description: 'Organize and manage work teams',
      color: 'text-purple-500'
    },
    {
      id: 'users',
      title: 'Users',
      icon: faUser,
      count: 24,
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
                <Badge variant="secondary" className="font-bold">
                  {setting.count}
                </Badge>
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