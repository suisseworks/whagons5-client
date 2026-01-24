import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faStar, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { BarChart3, Pin, PinOff } from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';
import {
  getPluginsConfig,
  togglePluginEnabled,
  togglePluginPinned,
  subscribeToPluginsConfig,
  type PluginConfig,
} from '@/components/AppSidebar';

export default function KpiCardsSettings() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pluginsConfig, setPluginsConfigState] = useState<PluginConfig[]>(getPluginsConfig());

  // Default to 'settings' tab
  const activeTab = searchParams.get('tab') || 'settings';

  useEffect(() => {
    const unsubscribe = subscribeToPluginsConfig(setPluginsConfigState);
    return unsubscribe;
  }, []);

  const currentPlugin = pluginsConfig.find(p => p.id === 'kpi-cards');

  const handleToggleEnabled = () => {
    togglePluginEnabled('kpi-cards');
  };

  const handleTogglePinned = () => {
    togglePluginPinned('kpi-cards');
  };

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  if (!currentPlugin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('plugins.notFound', 'Plugin not found')}</CardTitle>
            <CardDescription>
              {t('plugins.notFoundDescription', 'The requested plugin could not be found')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const Icon = currentPlugin.icon;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div 
          className="grid place-items-center rounded-lg flex-shrink-0"
          style={{
            backgroundColor: currentPlugin.iconColor,
            width: '48px',
            height: '48px',
          }}
        >
          <Icon size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t('kpiCards.title', 'KPI Cards')}</h1>
          <p className="text-muted-foreground">
            {activeTab === 'summary' ? t('plugins.summary', 'Overview') : t('plugins.settings', 'Settings')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-6">
          <button
            onClick={() => setTab('settings')}
            className={`pb-3 px-1 border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('plugins.settings', 'Settings')}
          </button>
          <button
            onClick={() => setTab('summary')}
            className={`pb-3 px-1 border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('plugins.summary', 'Summary')}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'settings' && (
        <div className="grid gap-6 max-w-2xl">
          {/* Visibility Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('plugins.visibility', 'Visibility')}</CardTitle>
              <CardDescription>
                {t('plugins.visibilityDescription', 'Control how this plugin appears in your sidebar')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">{t('plugins.enabled', 'Enabled')}</div>
                  <div className="text-sm text-muted-foreground">
                    {t('plugins.enabledDescription', 'Show this plugin in the sidebar')}
                  </div>
                </div>
                <Switch
                  checked={currentPlugin.enabled}
                  onCheckedChange={handleToggleEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium flex items-center gap-2">
                    {currentPlugin.pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                    {t('plugins.visibleInSidebar', 'Visible in sidebar')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('plugins.visibleInSidebarDescription', 'Show this plugin in the sidebar. When off, it will not appear in the navbar.')}
                  </div>
                </div>
                <Switch
                  checked={currentPlugin.pinned}
                  onCheckedChange={handleTogglePinned}
                  disabled={!currentPlugin.enabled}
                />
              </div>
            </CardContent>
          </Card>

          {/* About Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('plugins.about', 'About')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('plugins.pluginId', 'Plugin ID')}:</span>
                  <span className="font-mono">{currentPlugin.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('plugins.route', 'Route')}:</span>
                  <span className="font-mono">{currentPlugin.route}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Manage KPI Cards Button */}
          <Card>
            <CardHeader>
              <CardTitle>{t('kpiCards.manageCards', 'Manage KPI Cards')}</CardTitle>
              <CardDescription>
                {t('kpiCards.manageCardsDescription', 'Create and manage custom metrics cards for workspace dashboards')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate('/settings/kpi-cards/manage')}
                className="w-full"
              >
                {t('kpiCards.manageCards', 'Manage KPI Cards')}
                <FontAwesomeIcon icon={faArrowRight} className="ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="grid gap-6 max-w-3xl">
          {/* Overview Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FontAwesomeIcon icon={faStar} className="text-amber-500" />
                {t('plugins.keyFeatures', 'Key Features')}
              </CardTitle>
              <CardDescription>
                {t('plugins.keyFeaturesDescription', 'Discover what this plugin can do for you')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <FontAwesomeIcon 
                    icon={faCheck} 
                    className="text-emerald-500 mt-1 flex-shrink-0" 
                  />
                  <span className="text-sm">Create custom KPI cards with real-time task metrics</span>
                </li>
                <li className="flex items-start gap-3">
                  <FontAwesomeIcon 
                    icon={faCheck} 
                    className="text-emerald-500 mt-1 flex-shrink-0" 
                  />
                  <span className="text-sm">Display cards on workspace dashboards with drag-and-drop reordering</span>
                </li>
                <li className="flex items-start gap-3">
                  <FontAwesomeIcon 
                    icon={faCheck} 
                    className="text-emerald-500 mt-1 flex-shrink-0" 
                  />
                  <span className="text-sm">Support for task counts, percentages, trends, and custom queries</span>
                </li>
                <li className="flex items-start gap-3">
                  <FontAwesomeIcon 
                    icon={faCheck} 
                    className="text-emerald-500 mt-1 flex-shrink-0" 
                  />
                  <span className="text-sm">Workspace-specific or global card configurations</span>
                </li>
                <li className="flex items-start gap-3">
                  <FontAwesomeIcon 
                    icon={faCheck} 
                    className="text-emerald-500 mt-1 flex-shrink-0" 
                  />
                  <span className="text-sm">Customizable display options with colors and styling</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Benefits Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('plugins.benefits', 'Benefits')}</CardTitle>
              <CardDescription>
                {t('plugins.benefitsDescription', 'How this plugin adds value to your operations')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div 
                    className="mt-1 flex-shrink-0"
                    style={{ color: currentPlugin.iconColor }}
                  >
                    ✦
                  </div>
                  <span className="text-sm">Track key metrics at a glance on workspace dashboards</span>
                </li>
                <li className="flex items-start gap-3">
                  <div 
                    className="mt-1 flex-shrink-0"
                    style={{ color: currentPlugin.iconColor }}
                  >
                    ✦
                  </div>
                  <span className="text-sm">Make data-driven decisions with real-time insights</span>
                </li>
                <li className="flex items-start gap-3">
                  <div 
                    className="mt-1 flex-shrink-0"
                    style={{ color: currentPlugin.iconColor }}
                  >
                    ✦
                  </div>
                  <span className="text-sm">Customize metrics to match your team's specific needs</span>
                </li>
                <li className="flex items-start gap-3">
                  <div 
                    className="mt-1 flex-shrink-0"
                    style={{ color: currentPlugin.iconColor }}
                  >
                    ✦
                  </div>
                  <span className="text-sm">Improve visibility into task progress and completion trends</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Plugin Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('plugins.about', 'About')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('plugins.pluginId', 'Plugin ID')}:</span>
                  <span className="font-mono">{currentPlugin.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('plugins.route', 'Route')}:</span>
                  <span className="font-mono">{currentPlugin.route}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('plugins.status', 'Status')}:</span>
                  <span className={`font-medium ${currentPlugin.enabled ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                    {currentPlugin.enabled ? t('plugins.active', 'Active') : t('plugins.inactive', 'Inactive')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
