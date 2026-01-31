import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faStar, faBed, faWrench, faBell, faBoxOpen, faDoorOpen, faUsers, faClock, faChartLine } from '@fortawesome/free-solid-svg-icons';
import { Hotel, Pin, PinOff } from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';
import {
  getPluginsConfig,
  togglePluginEnabled,
  togglePluginPinned,
  subscribeToPluginsConfig,
  type PluginConfig,
} from '@/components/AppSidebar';

export default function HotelAnalyticsSettings() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pluginsConfig, setPluginsConfigState] = useState<PluginConfig[]>(getPluginsConfig());

  // Default to 'settings' tab
  const activeTab = searchParams.get('tab') || 'settings';

  useEffect(() => {
    const unsubscribe = subscribeToPluginsConfig(setPluginsConfigState);
    return unsubscribe;
  }, []);

  const currentPlugin = pluginsConfig.find(p => p.id === 'hotel-analytics');

  const handleToggleEnabled = () => {
    togglePluginEnabled('hotel-analytics');
  };

  const handleTogglePinned = () => {
    togglePluginPinned('hotel-analytics');
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
          <h1 className="text-3xl font-bold">{t('plugins.hotelAnalytics.title', 'Hotel Analytics')}</h1>
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
                  <span className="text-sm">Comprehensive hotel operations reporting across all departments</span>
                </li>
                <li className="flex items-start gap-3">
                  <FontAwesomeIcon 
                    icon={faCheck} 
                    className="text-emerald-500 mt-1 flex-shrink-0" 
                  />
                  <span className="text-sm">Real-time room status dashboards and occupancy tracking</span>
                </li>
                <li className="flex items-start gap-3">
                  <FontAwesomeIcon 
                    icon={faCheck} 
                    className="text-emerald-500 mt-1 flex-shrink-0" 
                  />
                  <span className="text-sm">Staff productivity and SLA compliance monitoring</span>
                </li>
                <li className="flex items-start gap-3">
                  <FontAwesomeIcon 
                    icon={faCheck} 
                    className="text-emerald-500 mt-1 flex-shrink-0" 
                  />
                  <span className="text-sm">Executive summaries and department comparisons</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Report Categories Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FontAwesomeIcon icon={faChartLine} className="text-blue-500" />
                Report Categories
              </CardTitle>
              <CardDescription>
                41 reports organized into 8 categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <FontAwesomeIcon icon={faBed} className="text-blue-500 w-4" />
                  <span>Housekeeping (6 reports)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FontAwesomeIcon icon={faWrench} className="text-orange-500 w-4" />
                  <span>Maintenance (6 reports)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FontAwesomeIcon icon={faBell} className="text-yellow-500 w-4" />
                  <span>Guest Requests (5 reports)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FontAwesomeIcon icon={faBoxOpen} className="text-purple-500 w-4" />
                  <span>Lost & Found (5 reports)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FontAwesomeIcon icon={faDoorOpen} className="text-teal-500 w-4" />
                  <span>Rooms (5 reports)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FontAwesomeIcon icon={faUsers} className="text-indigo-500 w-4" />
                  <span>Staff (5 reports)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FontAwesomeIcon icon={faClock} className="text-red-500 w-4" />
                  <span>SLA/Compliance (4 reports)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FontAwesomeIcon icon={faChartLine} className="text-emerald-500 w-4" />
                  <span>Executive (5 reports)</span>
                </div>
              </div>
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
