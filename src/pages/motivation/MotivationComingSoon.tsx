import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRocket, faQuoteLeft, faBell, faChartLine } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '@/providers/LanguageProvider';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function MotivationComingSoon() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div 
          className="grid place-items-center rounded-lg flex-shrink-0"
          style={{
            backgroundColor: '#eab308', // yellow-500
            width: '48px',
            height: '48px',
          }}
        >
          <FontAwesomeIcon icon={faRocket} className="text-white text-2xl" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t('plugins.motivation.title', 'Motivation')}</h1>
          <p className="text-muted-foreground">
            {t('motivation.comingSoon', 'Coming Soon')}
          </p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <FontAwesomeIcon icon={faRocket} className="text-yellow-500 text-2xl" />
            <CardTitle className="text-2xl">{t('motivation.comingSoonTitle', 'Motivation is Coming Soon!')}</CardTitle>
          </div>
          <CardDescription className="text-base">
            {t('motivation.comingSoonDescription', 'We\'re working hard to bring you an amazing motivation and engagement experience. Stay tuned!')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Features Preview */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FontAwesomeIcon icon={faRocket} className="text-yellow-500" />
              {t('motivation.plannedFeatures', 'Planned Features')}
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <FontAwesomeIcon 
                  icon={faQuoteLeft} 
                  className="text-yellow-500 mt-1 flex-shrink-0" 
                />
                <span className="text-sm">{t('motivation.featureQuotes', 'Daily motivational quotes and inspiration')}</span>
              </li>
              <li className="flex items-start gap-3">
                <FontAwesomeIcon 
                  icon={faBell} 
                  className="text-yellow-500 mt-1 flex-shrink-0" 
                />
                <span className="text-sm">{t('motivation.featureReminders', 'Personalized reminders and goal tracking')}</span>
              </li>
              <li className="flex items-start gap-3">
                <FontAwesomeIcon 
                  icon={faChartLine} 
                  className="text-yellow-500 mt-1 flex-shrink-0" 
                />
                <span className="text-sm">{t('motivation.featureMetrics', 'Engagement metrics and progress visualization')}</span>
              </li>
              <li className="flex items-start gap-3">
                <FontAwesomeIcon 
                  icon={faRocket} 
                  className="text-yellow-500 mt-1 flex-shrink-0" 
                />
                <span className="text-sm">{t('motivation.featureRewards', 'Recognition systems and achievement celebrations')}</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('motivation.settingsAvailable', 'Plugin settings are available in Settings > Plugins')}
                </p>
              </div>
              <Button 
                variant="outline"
                onClick={() => navigate('/settings/motivation')}
              >
                {t('motivation.goToSettings', 'Go to Settings')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
