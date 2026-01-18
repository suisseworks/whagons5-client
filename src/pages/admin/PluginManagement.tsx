import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	faPlug,
	faToggleOn,
	faToggleOff,
	faCog,
	faCheck,
	faTimes,
	faRefresh,
	faCircleInfo
} from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';
import api from '@/api/whagonsApi';
import { useLanguage } from '@/providers/LanguageProvider';

interface Plugin {
	id: number;
	slug: string;
	name: string;
	description: string;
	version: string;
	is_enabled: boolean;
	settings: Record<string, any>;
	required_permissions: string[];
	routes_count?: number;
	created_at: string;
	updated_at: string;
}

export default function PluginManagement() {
	const { t } = useLanguage();
	const [plugins, setPlugins] = useState<Plugin[]>([]);
	const [loading, setLoading] = useState(true);
	const [toggling, setToggling] = useState<Record<string, boolean>>({});

	const fetchPlugins = async () => {
		setLoading(true);
		try {
			const response = await api.get('/plugins?with_routes=true');
			if (response.data?.data) {
				setPlugins(response.data.data);
			}
		} catch (error) {
			console.error('Error fetching plugins:', error);
			toast.error(t('errors.failedToFetchPlugins', 'Failed to fetch plugins'));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchPlugins();
	}, []);

	const handleToggle = async (plugin: Plugin) => {
		setToggling(prev => ({ ...prev, [plugin.slug]: true }));
		try {
			const response = await api.patch(`/plugins/${plugin.slug}/toggle`, {
				is_enabled: !plugin.is_enabled,
			});

			if (response.data?.data) {
				setPlugins(prev =>
					prev.map(p =>
						p.slug === plugin.slug
							? { ...p, is_enabled: !p.is_enabled }
							: p
					)
				);
				toast.success(
					`${plugin.name} has been ${!plugin.is_enabled ? 'enabled' : 'disabled'}`
				);
			}
		} catch (error) {
			console.error('Error toggling plugin:', error);
			toast.error(
				`Failed to ${plugin.is_enabled ? 'disable' : 'enable'} ${plugin.name}`
			);
		} finally {
			setToggling(prev => ({ ...prev, [plugin.slug]: false }));
		}
	};

	const getPluginColor = (slug: string) => {
		const colors: Record<string, string> = {
			boards: 'bg-violet-500',
			automation: 'bg-blue-500',
			analytics: 'bg-purple-500',
			compliance: 'bg-emerald-500',
		};
		return colors[slug] || 'bg-gray-500';
	};

	if (loading) {
		return (
			<div className="p-6 space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold flex items-center gap-3">
							<FontAwesomeIcon icon={faPlug} className="text-primary" />
							Plugin Management
						</h1>
						<p className="text-muted-foreground mt-2">
							Manage and configure system plugins
						</p>
					</div>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{[1, 2, 3].map(i => (
						<Card key={i} className="animate-pulse">
							<CardHeader>
								<div className="h-6 bg-muted rounded w-1/3"></div>
								<div className="h-4 bg-muted rounded w-2/3 mt-2"></div>
							</CardHeader>
							<CardContent>
								<div className="h-20 bg-muted rounded"></div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold flex items-center gap-3">
						<FontAwesomeIcon icon={faPlug} className="text-primary" />
						Plugin Management
					</h1>
					<p className="text-muted-foreground mt-2">
						Manage and configure system plugins
					</p>
				</div>
				<Button
					onClick={fetchPlugins}
					variant="outline"
					size="sm"
					disabled={loading}
				>
					<FontAwesomeIcon icon={faRefresh} className="mr-2" />
					Refresh
				</Button>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Plugins
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{plugins.length}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Enabled
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-green-600">
							{plugins.filter(p => p.is_enabled).length}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Disabled
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-red-600">
							{plugins.filter(p => !p.is_enabled).length}
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Routes
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{plugins.reduce((sum, p) => sum + (p.routes_count || 0), 0)}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Plugin Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{plugins.map(plugin => (
					<Card
						key={plugin.id}
						className={`transition-all duration-300 ${
							plugin.is_enabled
								? 'border-l-4 border-l-green-500 shadow-md'
								: 'border-l-4 border-l-gray-300 opacity-75'
						}`}
					>
						<CardHeader>
							<div className="flex items-start justify-between">
								<div className="flex items-start gap-3">
									<div
										className={`w-12 h-12 rounded-lg ${getPluginColor(
											plugin.slug
										)} flex items-center justify-center text-white`}
									>
										<FontAwesomeIcon icon={faPlug} className="text-xl" />
									</div>
									<div>
										<CardTitle className="flex items-center gap-2">
											{plugin.name}
											<Badge
												variant={plugin.is_enabled ? 'default' : 'secondary'}
											>
												{plugin.is_enabled ? (
													<>
														<FontAwesomeIcon
															icon={faCheck}
															className="mr-1 text-xs"
														/>
														Enabled
													</>
												) : (
													<>
														<FontAwesomeIcon
															icon={faTimes}
															className="mr-1 text-xs"
														/>
														Disabled
													</>
												)}
											</Badge>
										</CardTitle>
										<CardDescription className="mt-1">
											{plugin.description}
										</CardDescription>
									</div>
								</div>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							{/* Plugin Info */}
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<span className="text-muted-foreground">Version:</span>
									<span className="ml-2 font-mono font-semibold">
										{plugin.version}
									</span>
								</div>
								<div>
									<span className="text-muted-foreground">Routes:</span>
									<span className="ml-2 font-semibold">
										{plugin.routes_count || 0}
									</span>
								</div>
								<div className="col-span-2">
									<span className="text-muted-foreground">Slug:</span>
									<code className="ml-2 px-2 py-0.5 bg-muted rounded text-xs font-mono">
										{plugin.slug}
									</code>
								</div>
							</div>

							{/* Required Permissions */}
							{plugin.required_permissions &&
								plugin.required_permissions.length > 0 && (
									<div>
										<div className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
											<FontAwesomeIcon
												icon={faCircleInfo}
												className="text-xs"
											/>
											Required Permissions:
										</div>
										<div className="flex flex-wrap gap-1">
											{plugin.required_permissions.map(perm => (
												<Badge key={perm} variant="outline" className="text-xs">
													{perm}
												</Badge>
											))}
										</div>
									</div>
								)}

							{/* Settings Preview */}
							{plugin.settings && Object.keys(plugin.settings).length > 0 && (
								<div>
									<div className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
										<FontAwesomeIcon icon={faCog} className="text-xs" />
										Settings:
									</div>
									<div className="bg-muted p-3 rounded text-xs font-mono max-h-32 overflow-y-auto">
										<pre>{JSON.stringify(plugin.settings, null, 2)}</pre>
									</div>
								</div>
							)}

							{/* Actions */}
							<div className="flex items-center justify-between pt-2 border-t">
								<div className="flex items-center gap-2">
									<Switch
										checked={plugin.is_enabled}
										onCheckedChange={() => handleToggle(plugin)}
										disabled={toggling[plugin.slug]}
										className="data-[state=checked]:bg-green-500"
									/>
									<span className="text-sm font-medium">
										{toggling[plugin.slug] ? (
											'Updating...'
										) : plugin.is_enabled ? (
											<>
												<FontAwesomeIcon
													icon={faToggleOn}
													className="mr-1 text-green-600"
												/>
												Active
											</>
										) : (
											<>
												<FontAwesomeIcon
													icon={faToggleOff}
													className="mr-1 text-gray-400"
												/>
												Inactive
											</>
										)}
									</span>
								</div>
								<div className="text-xs text-muted-foreground">
									Updated: {new Date(plugin.updated_at).toLocaleDateString()}
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{plugins.length === 0 && (
				<Card className="text-center py-12">
					<CardContent>
						<FontAwesomeIcon
							icon={faPlug}
							className="text-6xl text-muted-foreground mb-4"
						/>
						<p className="text-lg font-semibold mb-2">No plugins found</p>
						<p className="text-muted-foreground">
							There are no plugins installed in the system.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
