import { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBed,
  faWrench,
  faBell,
  faBoxOpen,
  faDoorOpen,
  faUsers,
  faClock,
  faChartLine,
  faClipboardCheck,
  faCalendarDay,
  faRotate,
  faUserClock,
  faSprayCanSparkles,
  faBottleWater,
  faListCheck,
  faCalendarAlt,
  faTriangleExclamation,
  faBan,
  faTruck,
  faDollarSign,
  faChartBar,
  faHourglass,
  faStar as faStarSolid,
  faCrown,
  faMagnifyingGlassChart,
  faBoxArchive,
  faEnvelopeCircleCheck,
  faPercent,
  faTrashCan,
  faGem,
  faTableCellsLarge,
  faClipboardList,
  faHistory,
  faBuilding,
  faLayerGroup,
  faUserGear,
  faGauge,
  faIdBadge,
  faUserShield,
  faGraduationCap,
  faCheckDouble,
  faExclamationCircle,
  faArrowTrendUp,
  faTachometerAlt,
  faSun,
  faCalendarWeek,
  faChartPie,
  faCoins,
  faPeopleGroup,
  faThumbsUp,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { UrlTabs } from "@/components/ui/url-tabs";
import { Hotel } from "lucide-react";
import { useLanguage } from "@/providers/LanguageProvider";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Puzzle piece SVG clip-path definitions with tabs extending OUTWARD
// Using SVG with objectBoundingBox allows values outside 0-1 for outward tabs
const PuzzleClipPaths = () => (
  <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
    <defs>
      {/* Type A: Tab extends RIGHT (outward to 1.15), notch on BOTTOM (inward) */}
      <clipPath id="puzzle-piece-a" clipPathUnits="objectBoundingBox">
        <path d="M 0 0 L 1 0 L 1 0.35 L 1.15 0.35 C 1.15 0.4, 1.15 0.5, 1.15 0.65 L 1 0.65 L 1 1 L 0.55 1 L 0.55 0.9 C 0.52 0.87, 0.5 0.87, 0.48 0.87 C 0.45 0.87, 0.42 0.9, 0.42 0.9 L 0.42 1 L 0 1 Z" />
      </clipPath>
      
      {/* Type B: Tab extends BOTTOM (outward to 1.15), notch on LEFT (inward) */}
      <clipPath id="puzzle-piece-b" clipPathUnits="objectBoundingBox">
        <path d="M 0 0 L 1 0 L 1 1 L 0.55 1 L 0.55 0.9 C 0.52 0.87, 0.5 0.87, 0.48 0.87 C 0.45 0.87, 0.42 0.9, 0.42 0.9 L 0.42 1 L 0 1 L 0 0.65 L -0.15 0.65 C -0.15 0.5, -0.15 0.35, -0.15 0.35 L 0 0.35 Z" />
      </clipPath>
      
      {/* Type C: Tab extends LEFT (outward from -0.15), notch on TOP (inward) */}
      <clipPath id="puzzle-piece-c" clipPathUnits="objectBoundingBox">
        <path d="M 0.42 0 L 0.42 -0.15 C 0.5 -0.15, 0.58 -0.15, 0.58 -0.15 L 0.58 0 L 1 0 L 1 1 L 0 1 L 0 0.65 L -0.15 0.65 C -0.15 0.5, -0.15 0.35, -0.15 0.35 L 0 0.35 L 0 0 Z" />
      </clipPath>
      
      {/* Type D: Tab extends TOP (outward from -0.15), notch on RIGHT (inward) */}
      <clipPath id="puzzle-piece-d" clipPathUnits="objectBoundingBox">
        <path d="M 0 0 L 0.42 0 L 0.42 -0.15 C 0.5 -0.15, 0.58 -0.15, 0.58 -0.15 L 0.58 0 L 1 0 L 1 0.35 L 1.15 0.35 C 1.15 0.5, 1.15 0.65, 1.15 0.65 L 1 0.65 L 1 1 L 0 1 Z" />
      </clipPath>
    </defs>
  </svg>
);

// Get puzzle clip-path URL based on card index
const PUZZLE_IDS = ['puzzle-piece-a', 'puzzle-piece-b', 'puzzle-piece-c', 'puzzle-piece-d'];
const getPuzzleClipPath = (index: number): string => {
  return `url(#${PUZZLE_IDS[index % PUZZLE_IDS.length]})`;
};

// Report card data interface
interface ReportCardData {
  id: string;
  icon: any;
  iconColor: string;
  titleKey: string;
  descriptionKey: string;
  category?: string;
  onClick?: () => void;
}

// Sortable Report Card component
interface SortableReportCardProps {
  card: ReportCardData;
  tab: string;
  isFavorite: boolean;
  onToggleFavorite: (reportId: string) => void;
  index: number;
}

function SortableReportCard({ card, tab, isFavorite, onToggleFavorite, index }: SortableReportCardProps) {
  const { t } = useLanguage();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const puzzleClipPath = getPuzzleClipPath(index);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggleFavorite(card.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? "opacity-50" : ""}`}
    >
      {/* Outer wrapper with padding to accommodate outward puzzle tabs */}
      <div 
        className="relative"
        style={{ 
          padding: '20px',
          overflow: 'visible',
          width: '100%',
          height: '100%',
        }}
      >
        {/* Drop-shadow wrapper (follows clip-path shape) */}
        <div
          className="transition-all duration-300 group"
          style={{
            filter: isDragging 
              ? `drop-shadow(0 10px 15px rgba(0,0,0,0.25))` 
              : `drop-shadow(0 4px 8px rgba(0,0,0,0.15))`,
            overflow: 'visible',
            position: 'relative',
            width: '120%',
            height: '120%',
            marginLeft: '-10%',
            marginTop: '-10%',
          }}
        >
          <Card
            className={`transition-all duration-300 select-none hover:scale-[1.02] cursor-grab active:cursor-grabbing relative border-0 ${isDragging ? 'scale-[1.01]' : ''}`}
            onClick={card.onClick || (() => alert(`${t(card.titleKey)} - Coming soon!`))}
            {...listeners}
            {...attributes}
            style={{
              width: '100%',
              height: '200px',
              clipPath: puzzleClipPath,
              background: `linear-gradient(135deg, ${card.iconColor}35 0%, ${card.iconColor}20 50%, ${card.iconColor}08 100%)`,
              overflow: 'visible',
            }}
          >
            <CardHeader 
              className="space-y-3" 
              style={{ 
                padding: '24px 28px 28px 28px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`text-3xl group-hover:scale-110 transition-transform duration-200`}
                  style={{ color: card.iconColor }}
                >
                  <FontAwesomeIcon icon={card.icon} />
                </div>
                <button
                  type="button"
                  className={`rounded-full p-2 transition text-sm ${
                    isFavorite
                      ? 'text-yellow-500'
                      : 'text-muted-foreground hover:text-yellow-500 opacity-0 group-hover:opacity-100'
                  }`}
                  onClick={handleFavoriteClick}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label={isFavorite ? t("hotelAnalytics.unfavorite", "Remove from favorites") : t("hotelAnalytics.favorite", "Add to favorites")}
                  title={isFavorite ? t("hotelAnalytics.unfavorite", "Remove from favorites") : t("hotelAnalytics.favorite", "Add to favorites")}
                >
                  <FontAwesomeIcon icon={isFavorite ? faStarSolid : faStarRegular} className="text-base" />
                </button>
              </div>
              <div className="space-y-1" style={{ minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <CardTitle 
                  className="text-base font-medium leading-tight" 
                  style={{ 
                    wordBreak: 'break-word', 
                    overflowWrap: 'break-word',
                    lineHeight: '1.3',
                    paddingTop: '8px',
                  }}
                >
                  {t(card.titleKey, card.id)}
                </CardTitle>
                {tab === "favorites" && card.category && (
                  <span className="inline-block text-xs text-muted-foreground bg-muted/80 px-2 py-0.5 rounded mt-1">
                    {t(`hotelAnalytics.tabs.${card.category}`, card.category)}
                  </span>
                )}
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper functions for localStorage
const FAVORITES_STORAGE_KEY = 'wh-hotel-analytics-favorites-v1';

function loadFavorites(): string[] {
  try {
    const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites: string[]) {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // Ignore storage errors
  }
}

// Reports grid component with drag and drop
interface ReportsGridProps {
  reports: ReportCardData[];
  tab: string;
  favoriteIds: string[];
  onToggleFavorite: (reportId: string) => void;
}

function ReportsGrid({ reports, tab, favoriteIds, onToggleFavorite }: ReportsGridProps) {
  const { t } = useLanguage();
  const storageKey = `hotel-analytics-order-${tab}`;
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  // Load saved order from localStorage
  const [orderedReports, setOrderedReports] = useState<ReportCardData[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const savedIds = JSON.parse(saved);
        const reportMap = new Map(reports.map(r => [r.id, r]));
        return savedIds
          .map((id: string) => reportMap.get(id))
          .filter(Boolean) as ReportCardData[];
      } catch {
        return reports;
      }
    }
    return reports;
  });

  // Update when reports change
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      setOrderedReports(reports);
    }
  }, [reports, storageKey]);

  const reportIds = useMemo(() => orderedReports.map(r => r.id), [orderedReports]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedReports.findIndex((r) => r.id === active.id);
    const newIndex = orderedReports.findIndex((r) => r.id === over.id);

    const newOrder = arrayMove(orderedReports, oldIndex, newIndex);
    setOrderedReports(newOrder);

    // Save to localStorage
    localStorage.setItem(storageKey, JSON.stringify(newOrder.map(r => r.id)));
  };

  return (
    <div className="p-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={reportIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {orderedReports.map((report, index) => (
              <SortableReportCard
                key={report.id}
                card={report}
                tab={tab}
                isFavorite={favoriteSet.has(report.id)}
                onToggleFavorite={onToggleFavorite}
                index={index}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// All reports data - shared across tabs
const ALL_REPORTS: Record<string, ReportCardData[]> = {
  housekeeping: [
    {
      id: "room-status-dashboard",
      icon: faClipboardCheck,
      iconColor: "#3b82f6",
      titleKey: "hotelAnalytics.housekeeping.roomStatusDashboard.title",
      descriptionKey: "hotelAnalytics.housekeeping.roomStatusDashboard.description",
      category: "housekeeping",
    },
    {
      id: "daily-summary",
      icon: faCalendarDay,
      iconColor: "#10b981",
      titleKey: "hotelAnalytics.housekeeping.dailySummary.title",
      descriptionKey: "hotelAnalytics.housekeeping.dailySummary.description",
      category: "housekeeping",
    },
    {
      id: "room-turnover",
      icon: faRotate,
      iconColor: "#8b5cf6",
      titleKey: "hotelAnalytics.housekeeping.roomTurnover.title",
      descriptionKey: "hotelAnalytics.housekeeping.roomTurnover.description",
      category: "housekeeping",
    },
    {
      id: "staff-productivity",
      icon: faUserClock,
      iconColor: "#f59e0b",
      titleKey: "hotelAnalytics.housekeeping.staffProductivity.title",
      descriptionKey: "hotelAnalytics.housekeeping.staffProductivity.description",
      category: "housekeeping",
    },
    {
      id: "deep-cleaning",
      icon: faSprayCanSparkles,
      iconColor: "#ec4899",
      titleKey: "hotelAnalytics.housekeeping.deepCleaning.title",
      descriptionKey: "hotelAnalytics.housekeeping.deepCleaning.description",
      category: "housekeeping",
    },
    {
      id: "amenities-usage",
      icon: faBottleWater,
      iconColor: "#06b6d4",
      titleKey: "hotelAnalytics.housekeeping.amenitiesUsage.title",
      descriptionKey: "hotelAnalytics.housekeeping.amenitiesUsage.description",
      category: "housekeeping",
    },
  ],
  maintenance: [
    {
      id: "open-work-orders",
      icon: faListCheck,
      iconColor: "#ef4444",
      titleKey: "hotelAnalytics.maintenance.openWorkOrders.title",
      descriptionKey: "hotelAnalytics.maintenance.openWorkOrders.description",
      category: "maintenance",
    },
    {
      id: "preventive-schedule",
      icon: faCalendarAlt,
      iconColor: "#3b82f6",
      titleKey: "hotelAnalytics.maintenance.preventiveSchedule.title",
      descriptionKey: "hotelAnalytics.maintenance.preventiveSchedule.description",
      category: "maintenance",
    },
    {
      id: "equipment-failure",
      icon: faTriangleExclamation,
      iconColor: "#f59e0b",
      titleKey: "hotelAnalytics.maintenance.equipmentFailure.title",
      descriptionKey: "hotelAnalytics.maintenance.equipmentFailure.description",
      category: "maintenance",
    },
    {
      id: "room-out-of-service",
      icon: faBan,
      iconColor: "#dc2626",
      titleKey: "hotelAnalytics.maintenance.roomOutOfService.title",
      descriptionKey: "hotelAnalytics.maintenance.roomOutOfService.description",
      category: "maintenance",
    },
    {
      id: "vendor-report",
      icon: faTruck,
      iconColor: "#8b5cf6",
      titleKey: "hotelAnalytics.maintenance.vendorReport.title",
      descriptionKey: "hotelAnalytics.maintenance.vendorReport.description",
      category: "maintenance",
    },
    {
      id: "cost-analysis",
      icon: faDollarSign,
      iconColor: "#10b981",
      titleKey: "hotelAnalytics.maintenance.costAnalysis.title",
      descriptionKey: "hotelAnalytics.maintenance.costAnalysis.description",
      category: "maintenance",
    },
  ],
  "guest-requests": [
    {
      id: "volume-analysis",
      icon: faChartBar,
      iconColor: "#3b82f6",
      titleKey: "hotelAnalytics.guestRequests.volumeAnalysis.title",
      descriptionKey: "hotelAnalytics.guestRequests.volumeAnalysis.description",
      category: "guest-requests",
    },
    {
      id: "response-time",
      icon: faHourglass,
      iconColor: "#f59e0b",
      titleKey: "hotelAnalytics.guestRequests.responseTime.title",
      descriptionKey: "hotelAnalytics.guestRequests.responseTime.description",
      category: "guest-requests",
    },
    {
      id: "satisfaction",
      icon: faThumbsUp,
      iconColor: "#10b981",
      titleKey: "hotelAnalytics.guestRequests.satisfaction.title",
      descriptionKey: "hotelAnalytics.guestRequests.satisfaction.description",
      category: "guest-requests",
    },
    {
      id: "vip-report",
      icon: faCrown,
      iconColor: "#8b5cf6",
      titleKey: "hotelAnalytics.guestRequests.vipReport.title",
      descriptionKey: "hotelAnalytics.guestRequests.vipReport.description",
      category: "guest-requests",
    },
    {
      id: "amenity-trends",
      icon: faMagnifyingGlassChart,
      iconColor: "#ec4899",
      titleKey: "hotelAnalytics.guestRequests.amenityTrends.title",
      descriptionKey: "hotelAnalytics.guestRequests.amenityTrends.description",
      category: "guest-requests",
    },
  ],
  "lost-found": [
    {
      id: "inventory",
      icon: faBoxArchive,
      iconColor: "#3b82f6",
      titleKey: "hotelAnalytics.lostFound.inventory.title",
      descriptionKey: "hotelAnalytics.lostFound.inventory.description",
      category: "lost-found",
    },
    {
      id: "pending-return",
      icon: faEnvelopeCircleCheck,
      iconColor: "#10b981",
      titleKey: "hotelAnalytics.lostFound.pendingReturn.title",
      descriptionKey: "hotelAnalytics.lostFound.pendingReturn.description",
      category: "lost-found",
    },
    {
      id: "claim-rate",
      icon: faPercent,
      iconColor: "#8b5cf6",
      titleKey: "hotelAnalytics.lostFound.claimRate.title",
      descriptionKey: "hotelAnalytics.lostFound.claimRate.description",
      category: "lost-found",
    },
    {
      id: "disposal-due",
      icon: faTrashCan,
      iconColor: "#f59e0b",
      titleKey: "hotelAnalytics.lostFound.disposalDue.title",
      descriptionKey: "hotelAnalytics.lostFound.disposalDue.description",
      category: "lost-found",
    },
    {
      id: "high-value",
      icon: faGem,
      iconColor: "#ec4899",
      titleKey: "hotelAnalytics.lostFound.highValue.title",
      descriptionKey: "hotelAnalytics.lostFound.highValue.description",
      category: "lost-found",
    },
  ],
  rooms: [
    {
      id: "occupancy-status",
      icon: faTableCellsLarge,
      iconColor: "#3b82f6",
      titleKey: "hotelAnalytics.rooms.occupancyStatus.title",
      descriptionKey: "hotelAnalytics.rooms.occupancyStatus.description",
      category: "rooms",
    },
    {
      id: "inspection",
      icon: faClipboardList,
      iconColor: "#10b981",
      titleKey: "hotelAnalytics.rooms.inspection.title",
      descriptionKey: "hotelAnalytics.rooms.inspection.description",
      category: "rooms",
    },
    {
      id: "history",
      icon: faHistory,
      iconColor: "#8b5cf6",
      titleKey: "hotelAnalytics.rooms.history.title",
      descriptionKey: "hotelAnalytics.rooms.history.description",
      category: "rooms",
    },
    {
      id: "floor-summary",
      icon: faBuilding,
      iconColor: "#f59e0b",
      titleKey: "hotelAnalytics.rooms.floorSummary.title",
      descriptionKey: "hotelAnalytics.rooms.floorSummary.description",
      category: "rooms",
    },
    {
      id: "room-type-performance",
      icon: faLayerGroup,
      iconColor: "#ec4899",
      titleKey: "hotelAnalytics.rooms.roomTypePerformance.title",
      descriptionKey: "hotelAnalytics.rooms.roomTypePerformance.description",
      category: "rooms",
    },
  ],
  staff: [
    {
      id: "assignment",
      icon: faUserGear,
      iconColor: "#3b82f6",
      titleKey: "hotelAnalytics.staff.assignment.title",
      descriptionKey: "hotelAnalytics.staff.assignment.description",
      category: "staff",
    },
    {
      id: "team-performance",
      icon: faGauge,
      iconColor: "#10b981",
      titleKey: "hotelAnalytics.staff.teamPerformance.title",
      descriptionKey: "hotelAnalytics.staff.teamPerformance.description",
      category: "staff",
    },
    {
      id: "individual-performance",
      icon: faIdBadge,
      iconColor: "#8b5cf6",
      titleKey: "hotelAnalytics.staff.individualPerformance.title",
      descriptionKey: "hotelAnalytics.staff.individualPerformance.description",
      category: "staff",
    },
    {
      id: "shift-coverage",
      icon: faUserShield,
      iconColor: "#f59e0b",
      titleKey: "hotelAnalytics.staff.shiftCoverage.title",
      descriptionKey: "hotelAnalytics.staff.shiftCoverage.description",
      category: "staff",
    },
    {
      id: "training-status",
      icon: faGraduationCap,
      iconColor: "#ec4899",
      titleKey: "hotelAnalytics.staff.trainingStatus.title",
      descriptionKey: "hotelAnalytics.staff.trainingStatus.description",
      category: "staff",
    },
  ],
  sla: [
    {
      id: "compliance-summary",
      icon: faCheckDouble,
      iconColor: "#10b981",
      titleKey: "hotelAnalytics.sla.complianceSummary.title",
      descriptionKey: "hotelAnalytics.sla.complianceSummary.description",
      category: "sla",
    },
    {
      id: "breach-analysis",
      icon: faExclamationCircle,
      iconColor: "#ef4444",
      titleKey: "hotelAnalytics.sla.breachAnalysis.title",
      descriptionKey: "hotelAnalytics.sla.breachAnalysis.description",
      category: "sla",
    },
    {
      id: "escalation",
      icon: faArrowTrendUp,
      iconColor: "#f59e0b",
      titleKey: "hotelAnalytics.sla.escalation.title",
      descriptionKey: "hotelAnalytics.sla.escalation.description",
      category: "sla",
    },
    {
      id: "response-time-trends",
      icon: faTachometerAlt,
      iconColor: "#3b82f6",
      titleKey: "hotelAnalytics.sla.responseTimeTrends.title",
      descriptionKey: "hotelAnalytics.sla.responseTimeTrends.description",
      category: "sla",
    },
  ],
  executive: [
    {
      id: "daily-summary-exec",
      icon: faSun,
      iconColor: "#f59e0b",
      titleKey: "hotelAnalytics.executive.dailySummary.title",
      descriptionKey: "hotelAnalytics.executive.dailySummary.description",
      category: "executive",
    },
    {
      id: "weekly-scorecard",
      icon: faCalendarWeek,
      iconColor: "#3b82f6",
      titleKey: "hotelAnalytics.executive.weeklyScorecard.title",
      descriptionKey: "hotelAnalytics.executive.weeklyScorecard.description",
      category: "executive",
    },
    {
      id: "monthly-review",
      icon: faChartPie,
      iconColor: "#8b5cf6",
      titleKey: "hotelAnalytics.executive.monthlyReview.title",
      descriptionKey: "hotelAnalytics.executive.monthlyReview.description",
      category: "executive",
    },
    {
      id: "cost-per-room",
      icon: faCoins,
      iconColor: "#10b981",
      titleKey: "hotelAnalytics.executive.costPerRoom.title",
      descriptionKey: "hotelAnalytics.executive.costPerRoom.description",
      category: "executive",
    },
    {
      id: "department-comparison",
      icon: faPeopleGroup,
      iconColor: "#ec4899",
      titleKey: "hotelAnalytics.executive.departmentComparison.title",
      descriptionKey: "hotelAnalytics.executive.departmentComparison.description",
      category: "executive",
    },
  ],
};

// Housekeeping Tab Content
function HousekeepingReports({ favoriteIds, onToggleFavorite }: { favoriteIds: string[]; onToggleFavorite: (id: string) => void }) {
  return <ReportsGrid reports={ALL_REPORTS.housekeeping} tab="housekeeping" favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />;
}

// Maintenance Tab Content
function MaintenanceReports({ favoriteIds, onToggleFavorite }: { favoriteIds: string[]; onToggleFavorite: (id: string) => void }) {
  return <ReportsGrid reports={ALL_REPORTS.maintenance} tab="maintenance" favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />;
}

// Guest Requests Tab Content
function GuestRequestsReports({ favoriteIds, onToggleFavorite }: { favoriteIds: string[]; onToggleFavorite: (id: string) => void }) {
  return <ReportsGrid reports={ALL_REPORTS["guest-requests"]} tab="guest-requests" favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />;
}

// Lost and Found Tab Content
function LostFoundReports({ favoriteIds, onToggleFavorite }: { favoriteIds: string[]; onToggleFavorite: (id: string) => void }) {
  return <ReportsGrid reports={ALL_REPORTS["lost-found"]} tab="lost-found" favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />;
}

// Rooms/Spots Tab Content
function RoomsReports({ favoriteIds, onToggleFavorite }: { favoriteIds: string[]; onToggleFavorite: (id: string) => void }) {
  return <ReportsGrid reports={ALL_REPORTS.rooms} tab="rooms" favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />;
}

// Staff Tab Content
function StaffReports({ favoriteIds, onToggleFavorite }: { favoriteIds: string[]; onToggleFavorite: (id: string) => void }) {
  return <ReportsGrid reports={ALL_REPORTS.staff} tab="staff" favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />;
}

// SLA/Compliance Tab Content
function SlaReports({ favoriteIds, onToggleFavorite }: { favoriteIds: string[]; onToggleFavorite: (id: string) => void }) {
  return <ReportsGrid reports={ALL_REPORTS.sla} tab="sla" favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />;
}

// Executive Tab Content
function ExecutiveReports({ favoriteIds, onToggleFavorite }: { favoriteIds: string[]; onToggleFavorite: (id: string) => void }) {
  return <ReportsGrid reports={ALL_REPORTS.executive} tab="executive" favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} />;
}

// Favorites Tab Content
function FavoritesReports({ favoriteIds, onToggleFavorite }: { favoriteIds: string[]; onToggleFavorite: (id: string) => void }) {
  const { t } = useLanguage();
  
  // Get all reports from all tabs
  const allReports = useMemo(() => {
    return Object.values(ALL_REPORTS).flat();
  }, []);

  // Filter to only favorites
  const favoriteReports = useMemo(() => {
    const favoriteSet = new Set(favoriteIds);
    return allReports.filter(report => favoriteSet.has(report.id));
  }, [allReports, favoriteIds]);

  const storageKey = 'hotel-analytics-order-favorites';

  // Load saved order from localStorage
  const [orderedReports, setOrderedReports] = useState<ReportCardData[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const savedIds = JSON.parse(saved);
        const reportMap = new Map(favoriteReports.map(r => [r.id, r]));
        const ordered = savedIds
          .map((id: string) => reportMap.get(id))
          .filter(Boolean) as ReportCardData[];
        // Add any new favorites that aren't in the saved order
        const newFavorites = favoriteReports.filter(r => !savedIds.includes(r.id));
        return [...ordered, ...newFavorites];
      } catch {
        return favoriteReports;
      }
    }
    return favoriteReports;
  });

  // Update when favorites change
  useEffect(() => {
    const favoriteSet = new Set(favoriteIds);
    const filtered = allReports.filter(r => favoriteSet.has(r.id));
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const savedIds = JSON.parse(saved);
        const reportMap = new Map(filtered.map(r => [r.id, r]));
        const ordered = savedIds
          .map((id: string) => reportMap.get(id))
          .filter(Boolean) as ReportCardData[];
        const newFavorites = filtered.filter(r => !savedIds.includes(r.id));
        setOrderedReports([...ordered, ...newFavorites]);
      } catch {
        setOrderedReports(filtered);
      }
    } else {
      setOrderedReports(filtered);
    }
  }, [favoriteIds, allReports, storageKey]);

  const reportIds = useMemo(() => orderedReports.map(r => r.id), [orderedReports]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedReports.findIndex((r) => r.id === active.id);
    const newIndex = orderedReports.findIndex((r) => r.id === over.id);

    const newOrder = arrayMove(orderedReports, oldIndex, newIndex);
    setOrderedReports(newOrder);

    // Save to localStorage
    localStorage.setItem(storageKey, JSON.stringify(newOrder.map(r => r.id)));
  };

  if (favoriteReports.length === 0) {
    return (
      <div className="p-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FontAwesomeIcon icon={faStarRegular} className="text-4xl text-muted-foreground mb-4" />
          <p className="text-lg font-semibold text-muted-foreground">
            {t("hotelAnalytics.favorites.empty", "No favorite reports yet")}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {t("hotelAnalytics.favorites.emptyDescription", "Click the star icon on any report to add it to favorites")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={reportIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {orderedReports.map((report, index) => (
              <SortableReportCard
                key={report.id}
                card={report}
                tab="favorites"
                isFavorite={true}
                onToggleFavorite={onToggleFavorite}
                index={index}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function HotelAnalytics() {
  const { t } = useLanguage();
  
  // Favorite state management
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavorites());

  const handleToggleFavorite = (reportId: string) => {
    setFavoriteIds((prev) => {
      const exists = prev.includes(reportId);
      const updated = exists ? prev.filter((id) => id !== reportId) : [...prev, reportId];
      saveFavorites(updated);
      return updated;
    });
  };

  const tabs = [
    {
      value: "favorites",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faStarSolid} />
          {t("hotelAnalytics.tabs.favorites", "Favorites")}
        </span>
      ),
      content: <FavoritesReports favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />,
    },
    {
      value: "housekeeping",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faBed} />
          {t("hotelAnalytics.tabs.housekeeping", "Housekeeping")}
        </span>
      ),
      content: <HousekeepingReports favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />,
    },
    {
      value: "maintenance",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faWrench} />
          {t("hotelAnalytics.tabs.maintenance", "Maintenance")}
        </span>
      ),
      content: <MaintenanceReports favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />,
    },
    {
      value: "guest-requests",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faBell} />
          {t("hotelAnalytics.tabs.guestRequests", "Guest Requests")}
        </span>
      ),
      content: <GuestRequestsReports favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />,
    },
    {
      value: "lost-found",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faBoxOpen} />
          {t("hotelAnalytics.tabs.lostFound", "Lost & Found")}
        </span>
      ),
      content: <LostFoundReports favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />,
    },
    {
      value: "rooms",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faDoorOpen} />
          {t("hotelAnalytics.tabs.rooms", "Rooms")}
        </span>
      ),
      content: <RoomsReports favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />,
    },
    {
      value: "staff",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faUsers} />
          {t("hotelAnalytics.tabs.staff", "Staff")}
        </span>
      ),
      content: <StaffReports favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />,
    },
    {
      value: "sla",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faClock} />
          {t("hotelAnalytics.tabs.sla", "SLA/Compliance")}
        </span>
      ),
      content: <SlaReports favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />,
    },
    {
      value: "executive",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faChartLine} />
          {t("hotelAnalytics.tabs.executive", "Executive")}
        </span>
      ),
      content: <ExecutiveReports favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} />,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* SVG clip-path definitions for puzzle shapes */}
      <PuzzleClipPaths />
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="grid place-items-center rounded-lg flex-shrink-0"
          style={{
            backgroundColor: "#10b981",
            width: "48px",
            height: "48px",
          }}
        >
          <Hotel className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t("hotelAnalytics.pageTitle", "Hotel Analytics")}</h1>
          <p className="text-muted-foreground">
            {t("hotelAnalytics.pageSubtitle", "Comprehensive reports for hotel operations")}
          </p>
        </div>
      </div>

      {/* Tabs with Reports */}
      <UrlTabs
        tabs={tabs}
        defaultValue="favorites"
        basePath="/hotel-analytics"
        tabParam="tab"
      />
    </div>
  );
}

export default HotelAnalytics;
