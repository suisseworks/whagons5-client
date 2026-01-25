import { Card, CardContent } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

interface StatCard {
  value: number | string;
  label: string;
  icon?: IconDefinition;
  iconColor?: string;
  valueColor?: string;
}

interface StatisticsCardsProps {
  cards: StatCard[];
  columns?: 1 | 2 | 3 | 4;
}

export const StatisticsCards = ({ cards, columns = 4 }: StatisticsCardsProps) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div className={`grid grid-cols-1 gap-4 ${gridCols[columns]}`}>
      {cards.map((card, index) => (
        <Card key={index}>
          <CardContent className="pt-6">
            <div className="text-center">
              <div 
                className="text-2xl font-bold"
                style={card.valueColor ? { color: card.valueColor } : undefined}
              >
                {card.value}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                {card.icon && (
                  <FontAwesomeIcon 
                    icon={card.icon} 
                    className="w-3 h-3"
                    style={card.iconColor ? { color: card.iconColor } : undefined}
                  />
                )}
                {card.label}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
