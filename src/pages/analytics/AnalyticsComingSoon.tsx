import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faRocket, faStar, faGift } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '@/providers/LanguageProvider';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function AnalyticsComingSoon() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div 
          className="grid place-items-center rounded-lg flex-shrink-0"
          style={{
            backgroundColor: '#3b82f6', // blue-500
            width: '48px',
            height: '48px',
          }}
        >
          <FontAwesomeIcon icon={faChartLine} className="text-white text-2xl" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t('plugins.analytics.title', 'Analytics')}</h1>
          <p className="text-muted-foreground">
            {t('analytics.comingSoon', 'Coming Soon')}
          </p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <FontAwesomeIcon icon={faRocket} className="text-blue-500 text-2xl" />
            <CardTitle className="text-2xl">{t('analytics.comingSoonTitle', 'Analytics is Coming Soon!')}</CardTitle>
          </div>
          <CardDescription className="text-base">
            {t('analytics.comingSoonDescription', 'We\'re working hard to bring you powerful analytics and insights. Stay tuned!')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Features Preview */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FontAwesomeIcon icon={faStar} className="text-amber-500" />
              {t('analytics.plannedFeatures', 'Planned Features')}
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <FontAwesomeIcon 
                  icon={faGift} 
                  className="text-blue-500 mt-1 flex-shrink-0" 
                />
                <span className="text-sm">{t('analytics.featureDashboard', 'Interactive dashboards with real-time metrics')}</span>
              </li>
              <li className="flex items-start gap-3">
                <FontAwesomeIcon 
                  icon={faGift} 
                  className="text-blue-500 mt-1 flex-shrink-0" 
                />
                <span className="text-sm">{t('analytics.featureReports', 'Customizable reports and data visualization')}</span>
              </li>
              <li className="flex items-start gap-3">
                <FontAwesomeIcon 
                  icon={faGift} 
                  className="text-blue-500 mt-1 flex-shrink-0" 
                />
                <span className="text-sm">{t('analytics.featureTrends', 'Trend analysis and performance tracking')}</span>
              </li>
              <li className="flex items-start gap-3">
                <FontAwesomeIcon 
                  icon={faGift} 
                  className="text-blue-500 mt-1 flex-shrink-0" 
                />
                <span className="text-sm">{t('analytics.featureExport', 'Data export and sharing capabilities')}</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('analytics.settingsAvailable', 'Plugin settings are available in Settings > Plugins')}
                </p>
              </div>
              <Button 
                variant="outline"
                onClick={() => navigate('/settings/analytics')}
              >
                {t('analytics.goToSettings', 'Go to Settings')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
