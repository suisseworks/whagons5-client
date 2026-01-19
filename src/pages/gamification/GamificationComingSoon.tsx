import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrophy, faRocket, faStar, faGift } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '@/providers/LanguageProvider';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function GamificationComingSoon() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div 
          className="grid place-items-center rounded-lg flex-shrink-0"
          style={{
            backgroundColor: '#a855f7', // purple-500
            width: '48px',
            height: '48px',
          }}
        >
          <FontAwesomeIcon icon={faTrophy} className="text-white text-2xl" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t('plugins.gamification.title', 'Gamification')}</h1>
          <p className="text-muted-foreground">
            {t('gamification.comingSoon', 'Coming Soon')}
          </p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <FontAwesomeIcon icon={faRocket} className="text-purple-500 text-2xl" />
            <CardTitle className="text-2xl">{t('gamification.comingSoonTitle', 'Gamification is Coming Soon!')}</CardTitle>
          </div>
          <CardDescription className="text-base">
            {t('gamification.comingSoonDescription', 'We\'re working hard to bring you an amazing gamification experience. Stay tuned!')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Features Preview */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FontAwesomeIcon icon={faStar} className="text-amber-500" />
              {t('gamification.plannedFeatures', 'Planned Features')}
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <FontAwesomeIcon 
                  icon={faGift} 
                  className="text-purple-500 mt-1 flex-shrink-0" 
                />
                <span className="text-sm">{t('gamification.featurePoints', 'Points system for task completion and achievements')}</span>
              </li>
              <li className="flex items-start gap-3">
                <FontAwesomeIcon 
                  icon={faGift} 
                  className="text-purple-500 mt-1 flex-shrink-0" 
                />
                <span className="text-sm">{t('gamification.featureBadges', 'Badges and achievements for milestones')}</span>
              </li>
              <li className="flex items-start gap-3">
                <FontAwesomeIcon 
                  icon={faGift} 
                  className="text-purple-500 mt-1 flex-shrink-0" 
                />
                <span className="text-sm">{t('gamification.featureLeaderboards', 'Leaderboards to track top performers')}</span>
              </li>
              <li className="flex items-start gap-3">
                <FontAwesomeIcon 
                  icon={faGift} 
                  className="text-purple-500 mt-1 flex-shrink-0" 
                />
                <span className="text-sm">{t('gamification.featureRewards', 'Reward systems and recognition')}</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('gamification.settingsAvailable', 'Plugin settings are available in Settings > Plugins')}
                </p>
              </div>
              <Button 
                variant="outline"
                onClick={() => navigate('/settings/gamification')}
              >
                {t('gamification.goToSettings', 'Go to Settings')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
