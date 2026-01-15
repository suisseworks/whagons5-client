import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBroom, faBoxesStacked, faUsers, faDollarSign, faWarehouse, faClock, faFileAlt, faChartBar, faGripVertical, faCog, faLock, faCheck, faStar, faHammer } from '@fortawesome/free-solid-svg-icons';
import { useState, useEffect, useMemo, useRef } from 'react';
import { getPluginsConfig, subscribeToPluginsConfig } from '@/components/AppSidebar';
import { Pin, X } from 'lucide-react';
import {
	DndContext,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
	DragEndEvent,
	DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLanguage } from '@/providers/LanguageProvider';
import api from '@/api/whagonsApi';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

const PLUGINS_ORDER_KEY = 'wh-plugins-order-v1';

interface PluginCard {
	id: string;
	title: string;
	description: string;
	icon: any;
	color: string;
	onClick?: () => void;
	configurable?: boolean;
	is_enabled?: boolean;
}

interface BackendPlugin {
	id: number;
	slug: string;
	name: string;
	description: string;
	is_enabled: boolean;
}

interface PluginModalData {
	id: string;
	title: string;
	description: string;
	icon: any;
	color: string;
	features: string[];
	benefits: string[];
}

interface SortablePluginCardProps {
	plugin: PluginCard;
	pluginsConfig: any[];
	onPluginClick: (id: string, isEnabled: boolean) => void;
	pluginStatuses: Record<string, boolean>;
	t: (key: string, fallback?: string) => string;
}

interface PluginCardDisplayProps {
	plugin: PluginCard;
	pluginsConfig: any[];
	onPluginClick: (id: string, isEnabled: boolean) => void;
	showDragHandle?: boolean;
	isDragging?: boolean;
	pluginStatuses: Record<string, boolean>;
	t: (key: string, fallback?: string) => string;
}

function PluginCardDisplay({
	plugin,
	pluginsConfig,
	onPluginClick,
	showDragHandle = false,
	isDragging = false,
	pluginStatuses,
	t,
}: PluginCardDisplayProps) {
	const isPinned = plugin.configurable && pluginsConfig.find(p => p.id === plugin.id)?.pinned;
	const isEnabled = pluginStatuses[plugin.id] ?? true; // Default to true if not found
	
	// Get border color for each plugin (for hover effects)
	const getPluginBorderColor = (pluginId: string) => {
		const borderColors: Record<string, string> = {
			cleaning: 'hover:border-emerald-500/40 hover:shadow-emerald-500/20',
			assets: 'hover:border-sky-500/40 hover:shadow-sky-500/20',
			teamconnect: 'hover:border-violet-500/40 hover:shadow-violet-500/20',
			compliance: 'hover:border-emerald-500/40 hover:shadow-emerald-500/20',
			analytics: 'hover:border-purple-500/40 hover:shadow-purple-500/20',
			clockin: 'hover:border-indigo-500/40 hover:shadow-indigo-500/20',
			costs: 'hover:border-amber-500/40 hover:shadow-amber-500/20',
			inventory: 'hover:border-teal-500/40 hover:shadow-teal-500/20',
			tools: 'hover:border-orange-500/40 hover:shadow-orange-500/20',
		};
		
		return borderColors[pluginId] || 'hover:border-gray-500/40 hover:shadow-gray-500/20';
	};

	const borderColor = getPluginBorderColor(plugin.id);

	return (
		<div
			className={`cursor-pointer transition-all duration-300 group select-none relative ${isDragging ? 'scale-105' : ''}`}
			onClick={(e) => {
				if (isDragging) {
					e.preventDefault();
					e.stopPropagation();
					return;
				}
				if (plugin.onClick) {
					plugin.onClick();
				} else if (plugin.configurable) {
					onPluginClick(plugin.id, isEnabled);
				}
			}}
		>
			<div className={`
				relative rounded-xl overflow-hidden
				bg-card/50 backdrop-blur-sm
				border-2 border-border/40
				transition-all duration-300
				hover:shadow-2xl hover:scale-105
				${isEnabled ? borderColor : 'opacity-70'}
				h-[180px]
			`}>
				{/* Top corner badges */}
				<div className="absolute top-2 right-2 flex items-center gap-2 z-20">
					{!isEnabled && (
						<div className="bg-destructive/90 text-destructive-foreground px-2 py-0.5 rounded-md text-xs font-semibold flex items-center gap-1">
							<FontAwesomeIcon icon={faLock} className="text-xs" />
							{t('plugins.disabled', 'Disabled')}
						</div>
					)}
					{isPinned && <Pin className={`h-3.5 w-3.5 ${plugin.color} drop-shadow-md`} />}
					{showDragHandle && (
						<div className="text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
							<FontAwesomeIcon icon={faGripVertical} className="text-xs" />
						</div>
					)}
				</div>

				{/* Content container */}
				<div className="relative z-10 h-full flex flex-col items-center justify-center p-4">
					{/* Large icon - protagonist */}
					<div className={`
						${plugin.color} 
						text-[3.5rem]
						mb-3
						drop-shadow-2xl
						transition-all duration-300
						group-hover:scale-110 
						group-hover:drop-shadow-[0_0_30px_currentColor]
						filter group-hover:brightness-110
					`}>
						<FontAwesomeIcon icon={plugin.icon} />
					</div>

					{/* Title */}
					<h3 className={`
						font-bold text-center mb-1.5
						transition-all duration-300
						${plugin.id === 'cleaning' ? 'text-lg' : 'text-base'}
					`}>
						{plugin.title}
					</h3>

					{/* Description - appears more visible on hover */}
					<p className={`
						text-xs text-center text-muted-foreground
						line-clamp-2
						opacity-60 group-hover:opacity-100
						transition-opacity duration-300
						px-1
					`}>
						{plugin.description}
					</p>
				</div>

				{/* Subtle radial gradient on hover for depth */}
				<div className={`
					absolute inset-0 
					bg-gradient-radial from-transparent via-transparent to-background/20
					opacity-0 group-hover:opacity-100
					transition-opacity duration-300
					pointer-events-none
				`}></div>
			</div>
		</div>
	);
}

function SortablePluginCard({ plugin, pluginsConfig, onPluginClick, pluginStatuses, t }: SortablePluginCardProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: plugin.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={{ ...style, touchAction: 'none' }}
			{...listeners}
			{...attributes}
			className="h-full cursor-grab active:cursor-grabbing"
		>
			<PluginCardDisplay
				plugin={plugin}
				pluginsConfig={pluginsConfig}
				onPluginClick={onPluginClick}
				showDragHandle
				isDragging={isDragging}
				pluginStatuses={pluginStatuses}
				t={t}
			/>
		</div>
	);
}

// Plugin Modal Component
function PluginModal({ plugin, isOpen, onClose, t }: { plugin: PluginModalData | null; isOpen: boolean; onClose: () => void; t: (key: string, fallback?: string) => string }) {
	if (!isOpen || !plugin) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
			<div 
				className="relative w-full max-w-2xl bg-card rounded-2xl shadow-2xl border-2 border-border overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header with gradient */}
				<div className={`relative p-8 pb-6 bg-gradient-to-br from-background via-background to-background/80`}>
					<button 
						onClick={onClose}
						className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted/50 transition-colors"
					>
						<X className="h-5 w-5" />
					</button>
					
					<div className="flex items-center gap-4">
						<div className={`${plugin.color} text-5xl drop-shadow-lg`}>
							<FontAwesomeIcon icon={plugin.icon} />
						</div>
						<div>
							<h2 className="text-3xl font-bold mb-1">{plugin.title}</h2>
							<p className="text-muted-foreground">{plugin.description}</p>
						</div>
					</div>
				</div>

				{/* Content */}
				<div className="p-8 space-y-6">
					{/* Features Section */}
					<div>
						<h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
							<FontAwesomeIcon icon={faStar} className="text-amber-500" />
							{t('plugin.keyFeatures', 'Key Features')}
						</h3>
						<ul className="space-y-2">
							{plugin.features.map((feature, index) => (
								<li key={index} className="flex items-start gap-2 text-sm">
									<FontAwesomeIcon icon={faCheck} className="text-emerald-500 mt-1 flex-shrink-0" />
									<span>{feature}</span>
								</li>
							))}
						</ul>
					</div>

					{/* Benefits Section */}
					<div>
						<h3 className="text-lg font-semibold mb-3">{t('plugin.whatYoullGet', "What You'll Get")}</h3>
						<ul className="space-y-2">
							{plugin.benefits.map((benefit, index) => (
								<li key={index} className="flex items-start gap-2 text-sm">
									<div className={`${plugin.color} mt-1 flex-shrink-0`}>✦</div>
									<span>{benefit}</span>
								</li>
							))}
						</ul>
					</div>

					{/* CTA Section */}
					<div className="pt-4 border-t border-border">
						<div className="flex items-center justify-between gap-4">
							<div>
								<p className="text-sm text-muted-foreground">{t('plugins.contactSalesDescription', 'Contact sales to enable this plugin')}</p>
							</div>
							<Button 
								className="bg-primary hover:bg-primary/90"
								onClick={() => {
									const subjectTemplate = t('plugins.pluginInquirySubject', 'Plugin Inquiry: {title}');
									const subject = subjectTemplate.replace('{title}', plugin.title);
									window.open(`mailto:sales@whagons.com?subject=${encodeURIComponent(subject)}`, '_blank');
								}}
							>
								{t('plugins.contactSalesButton', 'Contact Sales')}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

const loadOrder = (key: string): string[] => {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.map((id: any) => String(id)) : [];
	} catch {
		return [];
	}
};

const saveOrder = (key: string, ids: string[]) => {
	try {
		localStorage.setItem(key, JSON.stringify(ids));
	} catch {}
};

function Plugins() {
	const navigate = useNavigate();
	const { t } = useLanguage();
	const [pluginsConfig, setPluginsConfigState] = useState(getPluginsConfig());
	const [pluginStatuses, setPluginStatuses] = useState<Record<string, boolean>>({});
	const [loadingStatuses, setLoadingStatuses] = useState(true);
	const [selectedPlugin, setSelectedPlugin] = useState<PluginModalData | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);

	useEffect(() => {
		const unsubscribe = subscribeToPluginsConfig(setPluginsConfigState);
		return unsubscribe;
	}, []);

	// Fetch plugin statuses from backend
	useEffect(() => {
		const fetchPluginStatuses = async () => {
			try {
				const response = await api.get('/plugins');
				if (response.data?.data) {
					const statuses: Record<string, boolean> = {};
					response.data.data.forEach((p: BackendPlugin) => {
						statuses[p.slug] = p.is_enabled;
					});
					setPluginStatuses(statuses);
				}
			} catch (error) {
				console.error('Error fetching plugin statuses:', error);
				// Don't show error toast, just log it
			} finally {
				setLoadingStatuses(false);
			}
		};

		fetchPluginStatuses();
	}, []);

	// Plugin details for modal
	const getPluginDetails = (pluginId: string): PluginModalData | null => {
		const plugin = allPlugins.find(p => p.id === pluginId);
		if (!plugin) return null;

		const detailsMap: Record<string, { features: string[]; benefits: string[] }> = {
			cleaning: {
				features: [
					'Automated cleaning schedules and task assignments',
					'Quality inspection checklists with photo documentation',
					'Real-time staff location tracking and route optimization',
					'Inventory management for cleaning supplies',
					'Performance analytics and reporting dashboards'
				],
				benefits: [
					'Reduce cleaning time by up to 30% with optimized workflows',
					'Ensure consistent quality with standardized checklists',
					'Track supply costs and reduce waste',
					'Generate compliance reports automatically'
				]
			},
			assets: {
				features: [
					'Comprehensive asset tracking with QR/barcode scanning',
					'Maintenance scheduling and preventive care alerts',
					'Asset lifecycle management and depreciation tracking',
					'Inspection workflows with photo documentation',
					'Mobile app for field technicians'
				],
				benefits: [
					'Extend asset lifespan with proactive maintenance',
					'Reduce downtime with predictive maintenance alerts',
					'Track asset ROI and optimize capital expenditures',
					'Ensure compliance with safety inspections'
				]
			},
			analytics: {
				features: [
					'Customizable dashboards with real-time data visualization',
					'Automated report generation and scheduling',
					'Predictive analytics and trend forecasting',
					'Cross-module data integration',
					'Export to Excel, PDF, and custom formats'
				],
				benefits: [
					'Make data-driven decisions with actionable insights',
					'Identify cost-saving opportunities automatically',
					'Monitor KPIs in real-time across all departments',
					'Forecast future needs with AI-powered predictions'
				]
			},
			clockin: {
				features: [
					'Mobile time tracking with GPS verification',
					'Shift scheduling with conflict detection',
					'Overtime and break compliance monitoring',
					'Integration with payroll systems',
					'Attendance insights and reporting'
				],
				benefits: [
					'Eliminate time theft with GPS-verified clock-ins',
					'Reduce scheduling conflicts by 90%',
					'Ensure labor law compliance automatically',
					'Streamline payroll processing with accurate time data'
				]
			},
			costs: {
				features: [
					'Multi-level budget planning and tracking',
					'Purchase order management and approval workflows',
					'Vendor management and invoice processing',
					'Cost allocation across departments and projects',
					'Real-time budget variance alerts'
				],
				benefits: [
					'Reduce operational costs by up to 20%',
					'Prevent budget overruns with automated alerts',
					'Optimize vendor relationships with performance tracking',
					'Simplify financial reporting and audits'
				]
			},
			inventory: {
				features: [
					'Real-time stock level monitoring with auto-reorder',
					'Barcode/QR scanning for quick data entry',
					'Multi-location warehouse management',
					'Supplier management and order tracking',
					'Inventory valuation and FIFO/LIFO tracking'
				],
				benefits: [
					'Never run out of critical supplies with auto-reorder',
					'Reduce inventory costs by 25% with optimization',
					'Minimize waste with expiration date tracking',
					'Speed up stocktakes from days to hours'
				]
			},
			compliance: {
				features: [
					'Document management with version control',
					'Automated compliance checklist workflows',
					'Audit trail and reporting',
					'Certification and license tracking',
					'Training and qualification management'
				],
				benefits: [
					'Pass audits with confidence using automated documentation',
					'Track certifications and prevent lapses',
					'Reduce compliance risks with proactive alerts',
					'Generate audit-ready reports in minutes'
				]
			},
			tools: {
				features: [
					'Digital tool checkout and return system',
					'QR code scanning for quick lending',
					'Automatic return reminders and notifications',
					'Tool condition tracking and maintenance history',
					'Employee borrowing history and accountability'
				],
				benefits: [
					'Eliminate lost tools with digital tracking',
					'Reduce tool replacement costs by up to 40%',
					'Know who has what equipment at any time',
					'Ensure tools are maintained and returned on time'
				]
			},
		};

		return {
			id: plugin.id,
			title: plugin.title,
			description: plugin.description,
			icon: plugin.icon,
			color: plugin.color,
			features: detailsMap[pluginId]?.features || [],
			benefits: detailsMap[pluginId]?.benefits || []
		};
	};

	const handlePluginClick = (pluginId: string, isEnabled: boolean) => {
		if (isEnabled) {
			navigate(`/plugins/${pluginId}/settings`);
		} else {
			// Show modal for disabled plugins
			const details = getPluginDetails(pluginId);
			if (details) {
				setSelectedPlugin(details);
				setIsModalOpen(true);
			}
		}
	};

	// Define all plugins
	const allPlugins: PluginCard[] = useMemo(() => [
		{
			id: 'cleaning',
			title: t('plugins.cleaning.title', 'Cleaning'),
			description: t('plugins.cleaning.description', 'Cleaning workflows, schedules and services'),
			icon: faBroom,
			color: 'text-emerald-500',
			configurable: true,
		},
		{
			id: 'assets',
			title: t('plugins.assets.title', 'Assets'),
			description: t('plugins.assets.description', 'Asset tracking, inspections and maintenance'),
			icon: faBoxesStacked,
			color: 'text-sky-500',
			configurable: true,
		},
		{
			id: 'teamconnect',
			title: t('plugins.teamconnect.title', 'TeamConnect'),
			description: t('plugins.teamconnect.description', 'Team collaboration and directory integration'),
			icon: faUsers,
			color: 'text-violet-500',
			configurable: true,
		},
		{
			id: 'compliance',
			title: t('plugins.compliance.title', 'Compliance'),
			description: t('plugins.compliance.description', 'Compliance standards, audits and documentation'),
			icon: faFileAlt,
			color: 'text-emerald-500',
			configurable: true,
		},
		{
			id: 'analytics',
			title: t('plugins.analytics.title', 'Analytics'),
			description: t('plugins.analytics.description', 'Data insights, reports and performance metrics'),
			icon: faChartBar,
			color: 'text-purple-500',
			configurable: true,
		},
		{
			id: 'clockin',
			title: t('plugins.clockin.title', 'Clock-In'),
			description: t('plugins.clockin.description', 'Time tracking, shift planning and attendance insights'),
			icon: faClock,
			color: 'text-indigo-500',
			configurable: true,
		},
		{
			id: 'costs',
			title: t('plugins.costs.title', 'Costs'),
			description: t('plugins.costs.description', 'Cost management, budgeting and reporting'),
			icon: faDollarSign,
			color: 'text-amber-500',
			configurable: true,
		},
		{
			id: 'inventory',
			title: t('plugins.inventory.title', 'Inventory management'),
			description: t('plugins.inventory.description', 'Track stock levels, manage inventory and optimize supply chains'),
			icon: faWarehouse,
			color: 'text-teal-500',
			configurable: true,
		},
		{
			id: 'tools',
			title: t('plugins.tools.title', 'Tools'),
			description: t('plugins.tools.description', 'Tool lending, equipment borrowing and maintenance tool tracking'),
			icon: faHammer,
			color: 'text-orange-500',
			configurable: true,
		},
	], [t]);

	// Order state
	const [pluginOrder, setPluginOrder] = useState<string[]>(() => {
		const currentIds = allPlugins.map(p => p.id);
		const saved = loadOrder(PLUGINS_ORDER_KEY);
		return [...saved.filter(id => currentIds.includes(id)), ...currentIds.filter(id => !saved.includes(id))];
	});

	// Update order when plugins change
	useEffect(() => {
		const currentIds = allPlugins.map(p => p.id);
		const saved = loadOrder(PLUGINS_ORDER_KEY);
		const merged = [...saved.filter(id => currentIds.includes(id)), ...currentIds.filter(id => !saved.includes(id))];
		setPluginOrder(merged);
	}, [allPlugins.map(p => p.id).join(',')]);

	// Ordered plugins
	const orderedPlugins = useMemo(() => {
		const pluginMap = new Map(allPlugins.map(p => [p.id, p]));
		return pluginOrder.map(id => pluginMap.get(id)).filter(Boolean) as PluginCard[];
	}, [allPlugins, pluginOrder]);

	// dnd-kit sensors
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 3,
			},
		})
	);

	// Refs for drag state
	const isDraggingRef = useRef(false);
	const originalOverflowRef = useRef<string>('');
	const originalTouchActionRef = useRef<string>('');
	const originalPositionRef = useRef<string>('');
	const scrollPositionRef = useRef({ x: 0, y: 0 });
	const scrollLockAnimationFrameRef = useRef<number | null>(null);

	const handleDragStart = (_event: DragStartEvent) => {
		isDraggingRef.current = true;
		
		originalOverflowRef.current = document.body.style.overflow || '';
		originalTouchActionRef.current = document.body.style.touchAction || '';
		originalPositionRef.current = document.body.style.position || '';
		
		scrollPositionRef.current = {
			x: window.scrollX || document.documentElement.scrollLeft,
			y: window.scrollY || document.documentElement.scrollTop
		};
		
		document.body.style.position = 'fixed';
		document.body.style.top = `-${scrollPositionRef.current.y}px`;
		document.body.style.left = `-${scrollPositionRef.current.x}px`;
		document.body.style.width = '100%';
		document.body.style.overflow = 'hidden';
		document.body.style.touchAction = 'none';
		document.body.style.overscrollBehavior = 'none';
		document.documentElement.style.overflow = 'hidden';
		document.documentElement.style.touchAction = 'none';
		document.documentElement.style.overscrollBehavior = 'none';
	};

	const handleDragEnd = (event: DragEndEvent) => {
		isDraggingRef.current = false;
		
		const scrollY = scrollPositionRef.current.y;
		const scrollX = scrollPositionRef.current.x;
		
		document.body.style.position = originalPositionRef.current;
		document.body.style.top = '';
		document.body.style.left = '';
		document.body.style.width = '';
		document.body.style.overflow = originalOverflowRef.current;
		document.body.style.touchAction = originalTouchActionRef.current;
		document.body.style.overscrollBehavior = '';
		document.documentElement.style.overflow = '';
		document.documentElement.style.touchAction = '';
		document.documentElement.style.overscrollBehavior = '';
		
		window.scrollTo(scrollX, scrollY);

		// Handle reorder
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = pluginOrder.indexOf(String(active.id));
		const newIndex = pluginOrder.indexOf(String(over.id));

		if (oldIndex !== -1 && newIndex !== -1) {
			const newOrder = arrayMove(pluginOrder, oldIndex, newIndex);
			setPluginOrder(newOrder);
			saveOrder(PLUGINS_ORDER_KEY, newOrder);
		}
	};

	const pluginIds = useMemo(() => orderedPlugins.map(p => p.id), [orderedPlugins]);

	return (
		<>
			<div className="p-6 space-y-6">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold">{t('plugins.title', 'Plugins')}</h1>
					<div className="flex items-center gap-3">
						<button 
							className="text-xs px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex items-center gap-1.5" 
							onClick={() => navigate('/admin/plugins')}
						>
							<FontAwesomeIcon icon={faCog} className="text-xs" />
							{t('plugins.manage', 'Manage Plugins')}
						</button>
						<button className="text-sm underline" onClick={() => navigate(-1)}>
							{t('common.back', 'Back')}
						</button>
					</div>
				</div>

				<div className="space-y-4">
					<div className="text-sm text-muted-foreground">
						{t('plugins.dragHint', 'Drag cards to reorder. Click disabled plugins to learn more.')}
					</div>
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragStart={handleDragStart}
						onDragEnd={handleDragEnd}
					>
						<SortableContext items={pluginIds} strategy={rectSortingStrategy}>
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
								{orderedPlugins.map((plugin) => (
									<SortablePluginCard
										key={plugin.id}
										plugin={plugin}
										pluginsConfig={pluginsConfig}
										onPluginClick={handlePluginClick}
										pluginStatuses={pluginStatuses}
										t={t}
									/>
								))}
							</div>
						</SortableContext>
					</DndContext>
				</div>
			</div>

			{/* Plugin Info Modal */}
			<PluginModal 
				plugin={selectedPlugin}
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				t={t}
			/>
		</>
	);
}

export default Plugins;
