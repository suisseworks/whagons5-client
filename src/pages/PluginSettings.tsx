import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect } from 'react';
import { getPluginsConfig, togglePluginEnabled, togglePluginPinned, subscribeToPluginsConfig, type PluginConfig } from '@/components/AppSidebar';
import { Pin, PinOff } from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faStar } from '@fortawesome/free-solid-svg-icons';

interface PluginDetails {
	features: string[];
	benefits: string[];
}

function PluginSettings() {
	const { pluginId } = useParams<{ pluginId: string }>();
	const { t } = useLanguage();
	const [searchParams, setSearchParams] = useSearchParams();
	const [pluginsConfig, setPluginsConfigState] = useState<PluginConfig[]>(getPluginsConfig());
	
	// Default to 'settings' tab
	const activeTab = searchParams.get('tab') || 'settings';

	useEffect(() => {
		const unsubscribe = subscribeToPluginsConfig(setPluginsConfigState);
		return unsubscribe;
	}, []);

	const currentPlugin = pluginsConfig.find(p => p.id === pluginId);

	// Plugin details for summary tab
	const getPluginDetails = (pluginId: string): PluginDetails => {
		const detailsMap: Record<string, PluginDetails> = {
			broadcasts: {
				features: [
					'Send messages to multiple recipients (manual, role-based, or team-based)',
					'Track acknowledgments in real-time with progress bars',
					'Set priority levels (Low, Normal, High, Urgent)',
					'Automated reminders for pending acknowledgments',
					'Detailed reporting on who acknowledged and when'
				],
				benefits: [
					'Ensure important messages reach everyone',
					'Track compliance with communication requirements',
					'Save time with automated acknowledgment tracking',
					'Get real-time visibility into message status'
				]
			},
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
			boards: {
				features: [
					'Team collaboration boards and messaging',
					'Directory integration with user profiles',
					'Real-time notifications and updates',
					'File sharing and document collaboration',
					'Team activity feeds and engagement tracking'
				],
				benefits: [
					'Improve team communication and collaboration',
					'Reduce email clutter with centralized messaging',
					'Keep everyone informed with real-time updates',
					'Foster team engagement and culture'
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

		return detailsMap[pluginId] || { features: [], benefits: [] };
	};

	const pluginDetails = pluginId ? getPluginDetails(pluginId) : { features: [], benefits: [] };

	const handleToggleEnabled = () => {
		if (pluginId) {
			togglePluginEnabled(pluginId);
		}
	};

	const handleTogglePinned = () => {
		if (pluginId) {
			togglePluginPinned(pluginId);
		}
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

	// Get translated plugin name
	const getPluginName = (pluginId: string) => {
		return t(`plugins.${pluginId}.title`, currentPlugin.name);
	};

	return (
		<div className="p-6 space-y-6">
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
					<h1 className="text-3xl font-bold">{getPluginName(currentPlugin.id)}</h1>
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
								{pluginDetails.features.map((feature, index) => (
									<li key={index} className="flex items-start gap-3">
										<FontAwesomeIcon 
											icon={faCheck} 
											className="text-emerald-500 mt-1 flex-shrink-0" 
										/>
										<span className="text-sm">{feature}</span>
									</li>
								))}
							</ul>
						</CardContent>
					</Card>

					{/* Benefits Card */}
					<Card>
						<CardHeader>
							<CardTitle>{t('plugins.benefits', 'Benefits')}</CardTitle>
							<CardDescription>
								{t('plugins.benefitsDescription', 'How this plugin adds value to your operations')}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ul className="space-y-3">
								{pluginDetails.benefits.map((benefit, index) => (
									<li key={index} className="flex items-start gap-3">
										<div 
											className="mt-1 flex-shrink-0"
											style={{ color: currentPlugin.iconColor }}
										>
											✦
										</div>
										<span className="text-sm">{benefit}</span>
									</li>
								))}
							</ul>
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

export default PluginSettings;
