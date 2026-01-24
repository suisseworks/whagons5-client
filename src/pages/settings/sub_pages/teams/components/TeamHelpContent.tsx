import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faPen,
  faPalette,
  faSitemap,
  faUserTie,
  faToggleOn,
  faLayerGroup,
  faCheckCircle,
  faLightbulb,
  faPlus,
  faUsers,
  faChartBar,
  faCircleInfo
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface TeamHelpContentProps {
  translate: (key: string, fallback: string) => string;
  onAddTeam: () => void;
  onManageUsers: () => void;
}

interface HelpFieldCard {
  key: string;
  icon: IconDefinition;
  title: string;
  description: string;
}

interface HelpLifecycleStep {
  key: string;
  icon: IconDefinition;
  title: string;
  description: string;
}

export function TeamHelpContent({ translate, onAddTeam, onManageUsers }: TeamHelpContentProps) {
  const fieldCards: HelpFieldCard[] = [
    {
      key: 'name',
      icon: faPen,
      title: translate('help.fields.name.title', 'Name & description'),
      description: translate('help.fields.name.description', 'Pick a short, searchable label and explain the team\'s scope so other admins know when to use it.')
    },
    {
      key: 'appearance',
      icon: faPalette,
      title: translate('help.fields.appearance.title', 'Color & icon'),
      description: translate('help.fields.appearance.description', 'Visual cues keep the grid readable. Choose contrasting colors for squads that collaborate often.')
    },
    {
      key: 'hierarchy',
      icon: faSitemap,
      title: translate('help.fields.hierarchy.title', 'Parent team'),
      description: translate('help.fields.hierarchy.description', 'Nest teams to mirror departments or regions. Child teams inherit visibility rules from their parent.')
    },
    {
      key: 'lead',
      icon: faUserTie,
      title: translate('help.fields.lead.title', 'Team lead'),
      description: translate('help.fields.lead.description', 'Select a point of contact for escalations. Only users in the directory are available here.')
    },
    {
      key: 'status',
      icon: faToggleOn,
      title: translate('help.fields.status.title', 'Active toggle'),
      description: translate('help.fields.status.description', 'Archive a team without losing history by switching it off instead of deleting it.')
    },
    {
      key: 'relations',
      icon: faLayerGroup,
      title: translate('help.fields.relationships.title', 'Linked work'),
      description: translate('help.fields.relationships.description', 'Categories and tasks rely on their team. Reassign those items before removing a team.')
    }
  ];

  const lifecycleSteps: HelpLifecycleStep[] = [
    {
      key: 'plan',
      icon: faLightbulb,
      title: translate('help.lifecycle.plan.title', 'Plan your structure'),
      description: translate('help.lifecycle.plan.description', 'List the departments, squads or pods you support and decide which ones should be parent teams.')
    },
    {
      key: 'create',
      icon: faPlus,
      title: translate('help.lifecycle.create.title', 'Create & brand the team'),
      description: translate('help.lifecycle.create.description', 'Use consistent naming and colors so people can instantly recognize the team in filters and dashboards.')
    },
    {
      key: 'assign',
      icon: faUsers,
      title: translate('help.lifecycle.assign.title', 'Assign ownership'),
      description: translate('help.lifecycle.assign.description', 'Set the team lead, link categories, and make sure tasks are routed to the correct team.')
    },
    {
      key: 'measure',
      icon: faChartBar,
      title: translate('help.lifecycle.measure.title', 'Measure & iterate'),
      description: translate('help.lifecycle.measure.description', 'Review the Statistics tab to spot overloaded teams and rebalance categories or workloads.')
    }
  ];

  const bestPractices = [
    translate('help.bestPractices.visual', 'Reuse colors and icons only when teams collaborate closely to avoid visual noise.'),
    translate('help.bestPractices.naming', 'Stick to a naming convention (region-team-type) so searches stay predictable.'),
    translate('help.bestPractices.hierarchy', 'Use parent teams sparingly—two levels are usually enough for clear reporting.'),
    translate('help.bestPractices.integrity', 'Before deleting a team, verify with stakeholders that all tasks and categories have migrated.')
  ];

  const optionBullets = [
    translate('help.options.grid.actions', 'Use the action menu in the Teams grid to jump into quick edit or delete.'),
    translate('help.options.grid.search', 'Search instantly filters by team name or description when you need to find a squad.'),
    translate('help.options.grid.sort', 'Click column headers to sort by parent, lead, or status to identify gaps.'),
    translate('help.options.grid.quickEdit', 'Double-click a row to open editing with pre-filled data—no need to leave the grid.')
  ];

  const deletionReminders = [
    translate('help.deletion.guard', 'Teams that still own categories or tasks cannot be deleted for integrity reasons.'),
    translate('help.deletion.reassign', 'Reassign dependent categories/tasks first, then delete or archive the team.'),
    translate('help.deletion.archive', 'Keep historical reporting by toggling the team inactive instead of deleting it outright.')
  ];

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="space-y-4">
        <Card className="border border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FontAwesomeIcon icon={faCircleInfo} className="text-primary" />
              {translate('help.hero.title', 'Need a quick refresher on teams?')}
            </CardTitle>
            <CardDescription className="text-sm">
              {translate('help.hero.description', 'Understand what each option does before creating or updating teams.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={onAddTeam}>
                <FontAwesomeIcon icon={faPlus} className="mr-2 h-3.5 w-3.5" />
                {translate('help.hero.createAction', 'Create a team')}
              </Button>
              <Button size="sm" variant="outline" onClick={onManageUsers}>
                <FontAwesomeIcon icon={faUsers} className="mr-2 h-3.5 w-3.5" />
                {translate('help.hero.manageUsers', 'Assign or invite users')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {translate('help.fields.title', 'What each option controls')}
            </CardTitle>
            <CardDescription className="text-xs">
              {translate('help.fields.subtitle', 'Reference this checklist while filling the team form.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {fieldCards.map((card) => (
                <div
                  key={card.key}
                  className="flex gap-3 rounded-lg border border-border/60 bg-background/60 p-3 shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FontAwesomeIcon icon={card.icon} className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{card.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {card.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {translate('help.lifecycle.title', 'Recommended flow')}
              </CardTitle>
              <CardDescription className="text-xs">
                {translate('help.lifecycle.subtitle', 'Follow these steps to keep your structure clean.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lifecycleSteps.map((step, index) => (
                <div key={step.key} className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="secondary">
                      {translate('help.lifecycle.stepLabel', 'Step {step}').replace('{step}', String(index + 1))}
                    </Badge>
                    <FontAwesomeIcon icon={step.icon} className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-sm font-medium">{step.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {translate('help.bestPractices.title', 'Best practices')}
              </CardTitle>
              <CardDescription className="text-xs">
                {translate('help.bestPractices.subtitle', 'Avoid the most common pitfalls when configuring teams.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {bestPractices.map((tip, index) => (
                  <li key={`${tip}-${index}`} className="flex gap-2">
                    <FontAwesomeIcon icon={faCheckCircle} className="mt-1 h-3.5 w-3.5 text-emerald-500" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {translate('help.options.title', 'Where to manage everything')}
            </CardTitle>
            <CardDescription className="text-xs">
              {translate('help.options.subtitle', 'Use these areas to keep teams, users, and workload perfectly aligned.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FontAwesomeIcon icon={faLayerGroup} className="text-primary" />
                {translate('help.options.gridTitle', 'Teams grid')}
              </div>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                {optionBullets.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FontAwesomeIcon icon={faChartBar} className="text-primary" />
                {translate('help.options.statsTitle', 'Statistics & safety')}
              </div>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                {deletionReminders.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
