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
  faStar,
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
} from "@fortawesome/free-solid-svg-icons";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UrlTabs } from "@/components/ui/url-tabs";
import { Hotel } from "lucide-react";

// Report card component
interface ReportCardProps {
  icon: any;
  iconColor: string;
  title: string;
  description: string;
  onClick?: () => void;
}

function ReportCard({ icon, iconColor, title, description, onClick }: ReportCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[160px] overflow-hidden"
      onClick={onClick || (() => alert(`${title} - Coming soon!`))}
    >
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <div 
            className="text-3xl group-hover:scale-110 transition-transform duration-200"
            style={{ color: iconColor }}
          >
            <FontAwesomeIcon icon={icon} />
          </div>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}

// Reports grid component
function ReportsGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
      {children}
    </div>
  );
}

// Housekeeping Tab Content
function HousekeepingReports() {
  return (
    <ReportsGrid>
      <ReportCard
        icon={faClipboardCheck}
        iconColor="#3b82f6"
        title="Room Status Dashboard"
        description="Real-time overview of all rooms: clean, dirty, in-progress, inspected"
      />
      <ReportCard
        icon={faCalendarDay}
        iconColor="#10b981"
        title="Daily Housekeeping Summary"
        description="Tasks completed per day, avg time per room, staff productivity"
      />
      <ReportCard
        icon={faRotate}
        iconColor="#8b5cf6"
        title="Room Turnover Report"
        description="Time from checkout to ready, avg turnaround, bottlenecks"
      />
      <ReportCard
        icon={faUserClock}
        iconColor="#f59e0b"
        title="Staff Productivity Report"
        description="Rooms cleaned per housekeeper, SLA compliance rates"
      />
      <ReportCard
        icon={faSprayCanSparkles}
        iconColor="#ec4899"
        title="Deep Cleaning Schedule"
        description="Periodic deep cleaning tracking, rooms due and overdue"
      />
      <ReportCard
        icon={faBottleWater}
        iconColor="#06b6d4"
        title="Amenities/Supplies Usage"
        description="Consumption by room/floor: linens, toiletries, minibar"
      />
    </ReportsGrid>
  );
}

// Maintenance Tab Content
function MaintenanceReports() {
  return (
    <ReportsGrid>
      <ReportCard
        icon={faListCheck}
        iconColor="#ef4444"
        title="Open Work Orders"
        description="Active maintenance tasks by priority and assigned technician"
      />
      <ReportCard
        icon={faCalendarAlt}
        iconColor="#3b82f6"
        title="Preventive Maintenance Schedule"
        description="Scheduled vs completed PM tasks, compliance rate"
      />
      <ReportCard
        icon={faTriangleExclamation}
        iconColor="#f59e0b"
        title="Equipment Failure Analysis"
        description="Recurring issues by asset type: HVAC, plumbing, electrical"
      />
      <ReportCard
        icon={faBan}
        iconColor="#dc2626"
        title="Room Out-of-Service Report"
        description="Rooms unavailable due to maintenance, revenue impact"
      />
      <ReportCard
        icon={faTruck}
        iconColor="#8b5cf6"
        title="Vendor/Contractor Report"
        description="External maintenance work, response times, cost per vendor"
      />
      <ReportCard
        icon={faDollarSign}
        iconColor="#10b981"
        title="Maintenance Cost Analysis"
        description="Spending by category/room/floor, labor vs parts"
      />
    </ReportsGrid>
  );
}

// Guest Requests Tab Content
function GuestRequestsReports() {
  return (
    <ReportsGrid>
      <ReportCard
        icon={faChartBar}
        iconColor="#3b82f6"
        title="Request Volume Analysis"
        description="Requests by type, time, and channel, peak hours"
      />
      <ReportCard
        icon={faHourglass}
        iconColor="#f59e0b"
        title="Response Time Report"
        description="Time to acknowledge and fulfill, SLA breaches"
      />
      <ReportCard
        icon={faStar}
        iconColor="#10b981"
        title="Guest Satisfaction Tracking"
        description="Request completion quality, reopened requests"
      />
      <ReportCard
        icon={faCrown}
        iconColor="#8b5cf6"
        title="VIP/Loyalty Guest Report"
        description="Priority guest request handling, special accommodations"
      />
      <ReportCard
        icon={faMagnifyingGlassChart}
        iconColor="#ec4899"
        title="Amenity Request Trends"
        description="Most requested items/services: pillows, room service"
      />
    </ReportsGrid>
  );
}

// Lost and Found Tab Content
function LostFoundReports() {
  return (
    <ReportsGrid>
      <ReportCard
        icon={faBoxArchive}
        iconColor="#3b82f6"
        title="Inventory Report"
        description="All items by status: unclaimed, returned, disposed"
      />
      <ReportCard
        icon={faEnvelopeCircleCheck}
        iconColor="#10b981"
        title="Items Pending Return"
        description="Items with guest contact info, days in storage"
      />
      <ReportCard
        icon={faPercent}
        iconColor="#8b5cf6"
        title="Claim Rate Report"
        description="Items returned vs total found, avg days to claim"
      />
      <ReportCard
        icon={faTrashCan}
        iconColor="#f59e0b"
        title="Disposal Due Report"
        description="Items reaching retention limit, ready for disposal"
      />
      <ReportCard
        icon={faGem}
        iconColor="#ec4899"
        title="High-Value Items Report"
        description="Valuable items requiring special handling"
      />
    </ReportsGrid>
  );
}

// Rooms/Spots Tab Content
function RoomsReports() {
  return (
    <ReportsGrid>
      <ReportCard
        icon={faTableCellsLarge}
        iconColor="#3b82f6"
        title="Room Occupancy Status"
        description="Real-time room grid: occupied, vacant, due-out, due-in"
      />
      <ReportCard
        icon={faClipboardList}
        iconColor="#10b981"
        title="Room Inspection Report"
        description="Quality control results, pass/fail rates"
      />
      <ReportCard
        icon={faHistory}
        iconColor="#8b5cf6"
        title="Room History Report"
        description="All activities for a specific room over time"
      />
      <ReportCard
        icon={faBuilding}
        iconColor="#f59e0b"
        title="Floor/Wing Summary"
        description="Aggregated stats by location, problem areas"
      />
      <ReportCard
        icon={faLayerGroup}
        iconColor="#ec4899"
        title="Room Type Performance"
        description="Issues by room category: suites vs standard"
      />
    </ReportsGrid>
  );
}

// Staff Tab Content
function StaffReports() {
  return (
    <ReportsGrid>
      <ReportCard
        icon={faUserGear}
        iconColor="#3b82f6"
        title="Staff Assignment Report"
        description="Current workload distribution, tasks per user"
      />
      <ReportCard
        icon={faGauge}
        iconColor="#10b981"
        title="Team Performance Dashboard"
        description="Metrics by department/team, completion rates"
      />
      <ReportCard
        icon={faIdBadge}
        iconColor="#8b5cf6"
        title="Individual Performance Report"
        description="Detailed staff metrics, tasks completed, quality scores"
      />
      <ReportCard
        icon={faUserShield}
        iconColor="#f59e0b"
        title="Shift Coverage Report"
        description="Staff availability by shift, gaps in coverage"
      />
      <ReportCard
        icon={faGraduationCap}
        iconColor="#ec4899"
        title="Training/Certification Status"
        description="Staff qualifications, certifications due"
      />
    </ReportsGrid>
  );
}

// SLA/Compliance Tab Content
function SlaReports() {
  return (
    <ReportsGrid>
      <ReportCard
        icon={faCheckDouble}
        iconColor="#10b981"
        title="SLA Compliance Summary"
        description="Overall SLA performance, % met by category"
      />
      <ReportCard
        icon={faExclamationCircle}
        iconColor="#ef4444"
        title="SLA Breach Analysis"
        description="Detailed breach investigation, root causes"
      />
      <ReportCard
        icon={faArrowTrendUp}
        iconColor="#f59e0b"
        title="Priority Escalation Report"
        description="Tasks escalated due to delays, resolution rates"
      />
      <ReportCard
        icon={faTachometerAlt}
        iconColor="#3b82f6"
        title="Response Time Trends"
        description="Historical SLA performance over time"
      />
    </ReportsGrid>
  );
}

// Executive Tab Content
function ExecutiveReports() {
  return (
    <ReportsGrid>
      <ReportCard
        icon={faSun}
        iconColor="#f59e0b"
        title="Daily Operations Summary"
        description="Morning briefing: arrivals, departures, open tasks"
      />
      <ReportCard
        icon={faCalendarWeek}
        iconColor="#3b82f6"
        title="Weekly Performance Scorecard"
        description="Key KPIs for the week, tasks completed, SLA %"
      />
      <ReportCard
        icon={faChartPie}
        iconColor="#8b5cf6"
        title="Monthly Operations Review"
        description="Comprehensive monthly analysis, trends"
      />
      <ReportCard
        icon={faCoins}
        iconColor="#10b981"
        title="Cost per Occupied Room"
        description="Operations cost efficiency, labor, supplies"
      />
      <ReportCard
        icon={faPeopleGroup}
        iconColor="#ec4899"
        title="Department Comparison"
        description="Cross-team performance comparison"
      />
    </ReportsGrid>
  );
}

function HotelAnalytics() {
  const tabs = [
    {
      value: "housekeeping",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faBed} />
          Housekeeping
        </span>
      ),
      content: <HousekeepingReports />,
    },
    {
      value: "maintenance",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faWrench} />
          Maintenance
        </span>
      ),
      content: <MaintenanceReports />,
    },
    {
      value: "guest-requests",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faBell} />
          Guest Requests
        </span>
      ),
      content: <GuestRequestsReports />,
    },
    {
      value: "lost-found",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faBoxOpen} />
          Lost & Found
        </span>
      ),
      content: <LostFoundReports />,
    },
    {
      value: "rooms",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faDoorOpen} />
          Rooms
        </span>
      ),
      content: <RoomsReports />,
    },
    {
      value: "staff",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faUsers} />
          Staff
        </span>
      ),
      content: <StaffReports />,
    },
    {
      value: "sla",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faClock} />
          SLA/Compliance
        </span>
      ),
      content: <SlaReports />,
    },
    {
      value: "executive",
      label: (
        <span className="flex items-center gap-2">
          <FontAwesomeIcon icon={faChartLine} />
          Executive
        </span>
      ),
      content: <ExecutiveReports />,
    },
  ];

  return (
    <div className="p-6 space-y-6">
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
          <h1 className="text-3xl font-bold">Hotel Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive reports for hotel operations
          </p>
        </div>
      </div>

      {/* Tabs with Reports */}
      <UrlTabs
        tabs={tabs}
        defaultValue="housekeeping"
        basePath="/hotel-analytics"
        tabParam="tab"
      />
    </div>
  );
}

export default HotelAnalytics;
