import React, { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ClipboardList, Settings, Calendar, Clock, LayoutDashboard, Map as MapIcon, BarChart3 } from 'lucide-react';
import { TAB_ANIMATION, getTabInitialX, type TabAnimationConfig } from '@/config/tabAnimation';
import WorkspaceTable, { WorkspaceTableHandle } from '@/pages/spaces/components/WorkspaceTable';
import SettingsComponent from '@/pages/spaces/components/Settings';
import CalendarViewTab from '@/pages/spaces/components/CalendarViewTab';
import SchedulerViewTab from '@/pages/spaces/components/SchedulerViewTab';
import TaskBoardTab from '@/pages/spaces/components/TaskBoardTab';
import MapViewTab from '@/pages/spaces/components/MapViewTab';
import WorkspaceStatistics from '@/pages/spaces/components/WorkspaceStatistics';
import { useLanguage } from '@/providers/LanguageProvider';
import { WORKSPACE_TAB_PATHS, type WorkspaceTabKey } from '../constants';

type TabContentProps = {
  workspaceId: string | undefined;
  isAllWorkspaces: boolean;
  rowCache: React.MutableRefObject<Map<string, { rows: any[]; rowCount: number }>>;
  tableRef: React.RefObject<WorkspaceTableHandle | null>;
  searchText: string;
  groupBy: any;
  collapseGroups: boolean;
  tagDisplayMode: 'icon' | 'icon-text';
  computedRowHeight: number;
  activeTab: WorkspaceTabKey;
  prevActiveTab: WorkspaceTabKey;
  dynamicTabAnimation: TabAnimationConfig<WorkspaceTabKey>;
  getDynamicTabInitialX: (prev: WorkspaceTabKey | string | null | undefined, next: WorkspaceTabKey | string) => string | number;
  onFiltersChanged: (active: boolean) => void;
  onSelectionChanged: (ids: number[]) => void;
  onOpenTaskDialog: (task: any) => void;
  onReady: () => void;
  onFilterModelChange: (model: any) => void;
};

export function createWorkspaceTabs(props: TabContentProps) {
  const { t } = useLanguage();
  const {
    workspaceId,
    isAllWorkspaces,
    rowCache,
    tableRef,
    searchText,
    groupBy,
    collapseGroups,
    tagDisplayMode,
    computedRowHeight,
    activeTab,
    prevActiveTab,
    dynamicTabAnimation,
    getDynamicTabInitialX,
    onFiltersChanged,
    onSelectionChanged,
    onOpenTaskDialog,
    onReady,
    onFilterModelChange,
  } = props;

  return [
    {
      value: 'grid',
      label: (
        <div className="flex items-center gap-2 pl-4">
          <ClipboardList />
          <span className="tab-label-text">{t('workspace.tabs.tasks', 'Tasks')}</span>
        </div>
      ),
      forceMount: true,
      content: (
        <motion.div
          className='flex-1 h-full'
          key='grid'
          initial={false}
          animate={{ x: activeTab === 'grid' ? 0 : getDynamicTabInitialX(activeTab, 'grid') }}
          transition={activeTab === 'grid' ? TAB_ANIMATION.transition : { duration: 0 }}
        >
          <WorkspaceTable 
            key={isAllWorkspaces ? 'all' : (workspaceId || 'root')}
            ref={tableRef}
            rowCache={rowCache} 
            workspaceId={isAllWorkspaces ? 'all' : (workspaceId || '')} 
            searchText={searchText}
            onFiltersChanged={(active) => {
              onFiltersChanged(active);
              const model = tableRef.current?.getFilterModel?.();
              onFilterModelChange(model || null);
            }}
            onSelectionChanged={onSelectionChanged}
            onOpenTaskDialog={(task) => {
              (window as any).__taskDialogClickTime = performance.now();
              onOpenTaskDialog(task);
            }}
            rowHeight={computedRowHeight}
            groupBy={groupBy}
            collapseGroups={collapseGroups}
            tagDisplayMode={tagDisplayMode}
            onReady={onReady}
          />
        </motion.div>
      )
    },
    {
      value: 'calendar',
      label: (
        <div className="flex items-center gap-2 pl-4">
          <Calendar />
          <span className="tab-label-text">{t('workspace.tabs.calendar', 'Calendar')}</span>
        </div>
      ),
      content: (
        <motion.div className='flex-1 h-full' key='calendar' initial={{ x: getDynamicTabInitialX(prevActiveTab, 'calendar') }} animate={{ x: 0 }} transition={TAB_ANIMATION.transition}>
          <CalendarViewTab workspaceId={workspaceId} />
        </motion.div>
      )
    },
    {
      value: 'scheduler',
      label: (
        <div className="flex items-center gap-2 pl-4">
          <Clock />
          <span className="tab-label-text">{t('workspace.tabs.scheduler', 'Scheduler')}</span>
        </div>
      ),
      content: (
        <motion.div className='flex-1 h-full' key='scheduler' initial={{ x: getDynamicTabInitialX(prevActiveTab, 'scheduler') }} animate={{ x: 0 }} transition={TAB_ANIMATION.transition}>
          <SchedulerViewTab workspaceId={workspaceId} />
        </motion.div>
      )
    },
    {
      value: 'map',
      label: (
        <div className="flex items-center gap-2 pl-4">
          <MapIcon />
          <span className="tab-label-text">{t('workspace.tabs.map', 'Map')}</span>
        </div>
      ),
      content: (
        <motion.div className='flex-1 h-full' key='map' initial={{ x: getDynamicTabInitialX(prevActiveTab, 'map') }} animate={{ x: 0 }} transition={TAB_ANIMATION.transition}>
          <MapViewTab workspaceId={workspaceId} />
        </motion.div>
      )
    },
    {
      value: 'board',
      label: (
        <div className="flex items-center gap-2 pl-4">
          <LayoutDashboard />
          <span className="tab-label-text">{t('workspace.tabs.board', 'Board')}</span>
        </div>
      ),
      content: (
        <motion.div className='flex-1 h-full' key='board' initial={{ x: getDynamicTabInitialX(prevActiveTab, 'board') }} animate={{ x: 0 }} transition={TAB_ANIMATION.transition}>
          <TaskBoardTab workspaceId={workspaceId} />
        </motion.div>
      )
    },
    {
      value: 'statistics',
      label: (
        <div className="flex items-center gap-2" aria-label="Statistics">
          <div className="flex items-center justify-center w-6 h-6 rounded border border-border/60 bg-muted/40 text-muted-foreground">
            <BarChart3 className="w-4 h-4" strokeWidth={2.2} />
          </div>
          <span className="tab-label-text">{t('workspace.tabs.stats', 'Stats')}</span>
        </div>
      ),
      content: (
        <motion.div className='flex-1 h-full' key='statistics' initial={{ x: getDynamicTabInitialX(prevActiveTab, 'statistics') }} animate={{ x: 0 }} transition={TAB_ANIMATION.transition}>
          <WorkspaceStatistics workspaceId={workspaceId} />
        </motion.div>
      )
    },
    {
      value: 'settings',
      label: (
        <div className="flex items-center gap-2" aria-label="Settings">
          <div className="flex items-center justify-center w-6 h-6 rounded border border-border/60 bg-muted/30 text-muted-foreground">
            <Settings className="w-4 h-4" strokeWidth={2.2} />
          </div>
          <span className="tab-label-text">{t('workspace.tabs.config', 'Config')}</span>
        </div>
      ),
      content: (
        <motion.div className='flex-1 h-full' key='settings' initial={{ x: getDynamicTabInitialX(prevActiveTab, 'settings') }} animate={{ x: 0 }} transition={TAB_ANIMATION.transition}>
          <SettingsComponent workspaceId={workspaceId} />
        </motion.div>
      )
    }
  ];
}
