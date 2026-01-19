import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faPlus, faEdit, faTrash, faCheck, faX, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '@/providers/LanguageProvider';
import toast from 'react-hot-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Webhook {
	id?: number;
	name: string;
	url: string;
	method: string;
	headers?: Record<string, string>;
	payload?: Record<string, any>;
	timeout?: number;
	is_active?: boolean;
	events?: string[];
	created_at?: string;
	updated_at?: string;
}

interface ApiKey {
	id?: number;
	name: string;
	key: string;
	scopes?: string[];
	is_active?: boolean;
	created_at?: string;
	expires_at?: string | null;
}

const INTEGRATIONS_STORAGE_KEY = 'wh-integrations-webhooks-v1';
const API_KEYS_STORAGE_KEY = 'wh-integrations-api-keys-v1';

// Load webhooks from localStorage (temporary until backend is ready)
const loadWebhooks = (): Webhook[] => {
	try {
		const raw = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
		if (!raw) return [];
		return JSON.parse(raw);
	} catch {
		return [];
	}
};

// Save webhooks to localStorage
const saveWebhooks = (webhooks: Webhook[]) => {
	try {
		localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(webhooks));
	} catch (error) {
		console.error('Error saving webhooks:', error);
	}
};

// Load API keys from localStorage (temporary until backend is ready)
const loadApiKeys = (): ApiKey[] => {
	try {
		const raw = localStorage.getItem(API_KEYS_STORAGE_KEY);
		if (!raw) return [];
		return JSON.parse(raw);
	} catch {
		return [];
	}
};

// Save API keys to localStorage
const saveApiKeys = (apiKeys: ApiKey[]) => {
	try {
		localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(apiKeys));
	} catch (error) {
		console.error('Error saving API keys:', error);
	}
};

function Integrations() {
	const { t } = useLanguage();
	const [webhooks, setWebhooks] = useState<Webhook[]>(loadWebhooks());
	const [apiKeys, setApiKeys] = useState<ApiKey[]>(loadApiKeys());
	const [isWebhookDialogOpen, setIsWebhookDialogOpen] = useState(false);
	const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
	const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
	const [editingApiKey, setEditingApiKey] = useState<ApiKey | null>(null);
	const [testingWebhook, setTestingWebhook] = useState<number | null>(null);

	// Webhook form state
	const [webhookForm, setWebhookForm] = useState<Omit<Webhook, 'id' | 'created_at' | 'updated_at'>>({
		name: '',
		url: '',
		method: 'POST',
		headers: {},
		payload: {},
		timeout: 10,
		is_active: true,
		events: [],
	});

	// API Key form state
	const [apiKeyForm, setApiKeyForm] = useState<Omit<ApiKey, 'id' | 'key' | 'created_at'>>({
		name: '',
		scopes: [],
		is_active: true,
		expires_at: null,
	});

	// Load data from backend when available
	useEffect(() => {
		// TODO: Replace with actual API calls when backend is ready
		// const fetchWebhooks = async () => {
		//   try {
		//     const response = await api.get('/integrations/webhooks');
		//     setWebhooks(response.data);
		//   } catch (error) {
		//     console.error('Error fetching webhooks:', error);
		//   }
		// };
		// fetchWebhooks();
	}, []);

	const handleAddWebhook = () => {
		setEditingWebhook(null);
		setWebhookForm({
			name: '',
			url: '',
			method: 'POST',
			headers: {},
			payload: {},
			timeout: 10,
			is_active: true,
			events: [],
		});
		setIsWebhookDialogOpen(true);
	};

	const handleEditWebhook = (webhook: Webhook) => {
		setEditingWebhook(webhook);
		setWebhookForm({
			name: webhook.name,
			url: webhook.url,
			method: webhook.method,
			headers: webhook.headers || {},
			payload: webhook.payload || {},
			timeout: webhook.timeout || 10,
			is_active: webhook.is_active ?? true,
			events: webhook.events || [],
		});
		setIsWebhookDialogOpen(true);
	};

	const handleSaveWebhook = () => {
		if (!webhookForm.name.trim() || !webhookForm.url.trim()) {
			toast.error(t('integrations.errors.fillRequiredFields', 'Please fill in all required fields'));
			return;
		}

		try {
			if (editingWebhook?.id) {
				// Update existing webhook
				const updated = webhooks.map(w =>
					w.id === editingWebhook.id
						? { ...webhookForm, id: editingWebhook.id, updated_at: new Date().toISOString() }
						: w
				);
				setWebhooks(updated);
				saveWebhooks(updated);
				toast.success(t('integrations.webhookUpdated', 'Webhook updated successfully'));
			} else {
				// Create new webhook
				const newWebhook: Webhook = {
					...webhookForm,
					id: Date.now(),
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				};
				const updated = [...webhooks, newWebhook];
				setWebhooks(updated);
				saveWebhooks(updated);
				toast.success(t('integrations.webhookCreated', 'Webhook created successfully'));
			}
			setIsWebhookDialogOpen(false);
			setEditingWebhook(null);
		} catch (error) {
			toast.error(t('integrations.errors.saveError', 'Error saving webhook'));
		}
	};

	const handleDeleteWebhook = (id: number) => {
		if (confirm(t('integrations.confirmDeleteWebhook', 'Are you sure you want to delete this webhook?'))) {
			const updated = webhooks.filter(w => w.id !== id);
			setWebhooks(updated);
			saveWebhooks(updated);
			toast.success(t('integrations.webhookDeleted', 'Webhook deleted successfully'));
		}
	};

	const handleTestWebhook = async (webhook: Webhook) => {
		if (!webhook.id) return;
		
		setTestingWebhook(webhook.id);
		try {
			// TODO: Replace with actual API call when backend is ready
			// await api.post(`/integrations/webhooks/${webhook.id}/test`, {
			//   test: true
			// });
			
			// Simulate API call
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			toast.success(t('integrations.webhookTestSuccess', 'Webhook test sent successfully'));
		} catch (error) {
			toast.error(t('integrations.webhookTestError', 'Error testing webhook'));
		} finally {
			setTestingWebhook(null);
		}
	};

	const handleAddApiKey = () => {
		setEditingApiKey(null);
		setApiKeyForm({
			name: '',
			scopes: [],
			is_active: true,
			expires_at: null,
		});
		setIsApiKeyDialogOpen(true);
	};

	const handleEditApiKey = (apiKey: ApiKey) => {
		setEditingApiKey(apiKey);
		setApiKeyForm({
			name: apiKey.name,
			scopes: apiKey.scopes || [],
			is_active: apiKey.is_active ?? true,
			expires_at: apiKey.expires_at || null,
		});
		setIsApiKeyDialogOpen(true);
	};

	const handleSaveApiKey = () => {
		if (!apiKeyForm.name.trim()) {
			toast.error(t('integrations.errors.fillRequiredFields', 'Please fill in all required fields'));
			return;
		}

		try {
			if (editingApiKey?.id) {
				// Update existing API key
				const updated = apiKeys.map(k =>
					k.id === editingApiKey.id
						? { ...apiKeyForm, id: editingApiKey.id, key: editingApiKey.key }
						: k
				);
				setApiKeys(updated);
				saveApiKeys(updated);
				toast.success(t('integrations.apiKeyUpdated', 'API key updated successfully'));
			} else {
				// Generate new API key
				const newKey = `wh_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
				const newApiKey: ApiKey = {
					...apiKeyForm,
					id: Date.now(),
					key: newKey,
					created_at: new Date().toISOString(),
				};
				const updated = [...apiKeys, newApiKey];
				setApiKeys(updated);
				saveApiKeys(updated);
				toast.success(t('integrations.apiKeyCreated', 'API key created successfully'));
			}
			setIsApiKeyDialogOpen(false);
			setEditingApiKey(null);
		} catch (error) {
			toast.error(t('integrations.errors.saveError', 'Error saving API key'));
		}
	};

	const handleDeleteApiKey = (id: number) => {
		if (confirm(t('integrations.confirmDeleteApiKey', 'Are you sure you want to delete this API key?'))) {
			const updated = apiKeys.filter(k => k.id !== id);
			setApiKeys(updated);
			saveApiKeys(updated);
			toast.success(t('integrations.apiKeyDeleted', 'API key deleted successfully'));
		}
	};

	const toggleWebhookActive = (id: number) => {
		const updated = webhooks.map(w =>
			w.id === id ? { ...w, is_active: !w.is_active } : w
		);
		setWebhooks(updated);
		saveWebhooks(updated);
	};

	const toggleApiKeyActive = (id: number) => {
		const updated = apiKeys.map(k =>
			k.id === id ? { ...k, is_active: !k.is_active } : k
		);
		setApiKeys(updated);
		saveApiKeys(updated);
	};

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">{t('integrations.title', 'Integrations')}</h1>
					<p className="text-muted-foreground mt-2">
						{t('integrations.description', 'Manage webhooks, API keys, and external integrations')}
					</p>
				</div>
			</div>

			<Tabs defaultValue="webhooks" className="space-y-4">
				<TabsList>
					<TabsTrigger value="webhooks">
						<FontAwesomeIcon icon={faLink} className="mr-2" />
						{t('integrations.webhooks', 'Webhooks')}
					</TabsTrigger>
					<TabsTrigger value="api-keys">
						{t('integrations.apiKeys', 'API Keys')}
					</TabsTrigger>
				</TabsList>

				<TabsContent value="webhooks" className="space-y-4">
					<div className="flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							{t('integrations.webhooksDescription', 'Configure webhooks to receive real-time notifications from external systems')}
						</p>
						<Button onClick={handleAddWebhook}>
							<FontAwesomeIcon icon={faPlus} className="mr-2" />
							{t('integrations.addWebhook', 'Add Webhook')}
						</Button>
					</div>

					{webhooks.length === 0 ? (
						<Card>
							<CardContent className="flex flex-col items-center justify-center py-12">
								<FontAwesomeIcon icon={faLink} className="text-4xl text-muted-foreground mb-4" />
								<p className="text-muted-foreground mb-4">
									{t('integrations.noWebhooks', 'No webhooks configured')}
								</p>
								<Button onClick={handleAddWebhook} variant="outline">
									<FontAwesomeIcon icon={faPlus} className="mr-2" />
									{t('integrations.addWebhook', 'Add Webhook')}
								</Button>
							</CardContent>
						</Card>
					) : (
						<div className="grid gap-4">
							{webhooks.map((webhook) => (
								<Card key={webhook.id}>
									<CardHeader>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<CardTitle>{webhook.name}</CardTitle>
												<Badge variant={webhook.is_active ? 'default' : 'secondary'}>
													{webhook.is_active
														? t('integrations.active', 'Active')
														: t('integrations.inactive', 'Inactive')}
												</Badge>
											</div>
											<div className="flex items-center gap-2">
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleTestWebhook(webhook)}
													disabled={testingWebhook === webhook.id}
												>
													{testingWebhook === webhook.id ? (
														<FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
													) : (
														<FontAwesomeIcon icon={faCheck} className="mr-2" />
													)}
													{t('integrations.test', 'Test')}
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => toggleWebhookActive(webhook.id!)}
												>
													<FontAwesomeIcon icon={webhook.is_active ? faX : faCheck} className="mr-2" />
													{webhook.is_active
														? t('integrations.deactivate', 'Deactivate')
														: t('integrations.activate', 'Activate')}
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleEditWebhook(webhook)}
												>
													<FontAwesomeIcon icon={faEdit} className="mr-2" />
													{t('common.edit', 'Edit')}
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleDeleteWebhook(webhook.id!)}
												>
													<FontAwesomeIcon icon={faTrash} className="mr-2" />
													{t('common.delete', 'Delete')}
												</Button>
											</div>
										</div>
									</CardHeader>
									<CardContent>
										<div className="space-y-2 text-sm">
											<div>
												<span className="font-medium">{t('integrations.url', 'URL')}:</span>{' '}
												<code className="bg-muted px-2 py-1 rounded">{webhook.url}</code>
											</div>
											<div>
												<span className="font-medium">{t('integrations.method', 'Method')}:</span>{' '}
												<Badge variant="outline">{webhook.method}</Badge>
											</div>
											{webhook.events && webhook.events.length > 0 && (
												<div>
													<span className="font-medium">{t('integrations.events', 'Events')}:</span>{' '}
													{webhook.events.map((event, idx) => (
														<Badge key={idx} variant="secondary" className="ml-1">
															{event}
														</Badge>
													))}
												</div>
											)}
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</TabsContent>

				<TabsContent value="api-keys" className="space-y-4">
					<div className="flex items-center justify-between">
						<p className="text-sm text-muted-foreground">
							{t('integrations.apiKeysDescription', 'Manage API keys for programmatic access to your workspace')}
						</p>
						<Button onClick={handleAddApiKey}>
							<FontAwesomeIcon icon={faPlus} className="mr-2" />
							{t('integrations.addApiKey', 'Add API Key')}
						</Button>
					</div>

					{apiKeys.length === 0 ? (
						<Card>
							<CardContent className="flex flex-col items-center justify-center py-12">
								<FontAwesomeIcon icon={faLink} className="text-4xl text-muted-foreground mb-4" />
								<p className="text-muted-foreground mb-4">
									{t('integrations.noApiKeys', 'No API keys configured')}
								</p>
								<Button onClick={handleAddApiKey} variant="outline">
									<FontAwesomeIcon icon={faPlus} className="mr-2" />
									{t('integrations.addApiKey', 'Add API Key')}
								</Button>
							</CardContent>
						</Card>
					) : (
						<div className="grid gap-4">
							{apiKeys.map((apiKey) => (
								<Card key={apiKey.id}>
									<CardHeader>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<CardTitle>{apiKey.name}</CardTitle>
												<Badge variant={apiKey.is_active ? 'default' : 'secondary'}>
													{apiKey.is_active
														? t('integrations.active', 'Active')
														: t('integrations.inactive', 'Inactive')}
												</Badge>
											</div>
											<div className="flex items-center gap-2">
												<Button
													variant="outline"
													size="sm"
													onClick={() => toggleApiKeyActive(apiKey.id!)}
												>
													<FontAwesomeIcon icon={apiKey.is_active ? faX : faCheck} className="mr-2" />
													{apiKey.is_active
														? t('integrations.deactivate', 'Deactivate')
														: t('integrations.activate', 'Activate')}
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleEditApiKey(apiKey)}
												>
													<FontAwesomeIcon icon={faEdit} className="mr-2" />
													{t('common.edit', 'Edit')}
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleDeleteApiKey(apiKey.id!)}
												>
													<FontAwesomeIcon icon={faTrash} className="mr-2" />
													{t('common.delete', 'Delete')}
												</Button>
											</div>
										</div>
									</CardHeader>
									<CardContent>
										<div className="space-y-2 text-sm">
											<div>
												<span className="font-medium">{t('integrations.key', 'Key')}:</span>{' '}
												<code className="bg-muted px-2 py-1 rounded font-mono text-xs">
													{apiKey.key.substring(0, 20)}...
												</code>
											</div>
											{apiKey.scopes && apiKey.scopes.length > 0 && (
												<div>
													<span className="font-medium">{t('integrations.scopes', 'Scopes')}:</span>{' '}
													{apiKey.scopes.map((scope, idx) => (
														<Badge key={idx} variant="secondary" className="ml-1">
															{scope}
														</Badge>
													))}
												</div>
											)}
											{apiKey.created_at && (
												<div>
													<span className="font-medium">{t('integrations.created', 'Created')}:</span>{' '}
													{new Date(apiKey.created_at).toLocaleDateString()}
												</div>
											)}
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</TabsContent>
			</Tabs>

			{/* Webhook Dialog */}
			<Dialog open={isWebhookDialogOpen} onOpenChange={setIsWebhookDialogOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingWebhook
								? t('integrations.editWebhook', 'Edit Webhook')
								: t('integrations.addWebhook', 'Add Webhook')}
						</DialogTitle>
						<DialogDescription>
							{t('integrations.webhookDialogDescription', 'Configure webhook settings to receive notifications')}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div>
							<Label htmlFor="webhook-name">{t('integrations.name', 'Name')} *</Label>
							<Input
								id="webhook-name"
								value={webhookForm.name}
								onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
								placeholder={t('integrations.webhookNamePlaceholder', 'My Webhook')}
								required
							/>
						</div>

						<div>
							<Label htmlFor="webhook-url">{t('integrations.url', 'URL')} *</Label>
							<Input
								id="webhook-url"
								type="url"
								value={webhookForm.url}
								onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
								placeholder="https://api.example.com/webhook"
								required
							/>
						</div>

						<div>
							<Label htmlFor="webhook-method">{t('integrations.method', 'HTTP Method')}</Label>
							<Select
								value={webhookForm.method}
								onValueChange={(value) => setWebhookForm({ ...webhookForm, method: value })}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="GET">GET</SelectItem>
									<SelectItem value="POST">POST</SelectItem>
									<SelectItem value="PUT">PUT</SelectItem>
									<SelectItem value="PATCH">PATCH</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="webhook-headers">{t('integrations.headers', 'Headers (JSON)')}</Label>
							<Textarea
								id="webhook-headers"
								value={webhookForm.headers ? JSON.stringify(webhookForm.headers, null, 2) : '{}'}
								onChange={(e) => {
									try {
										const parsed = JSON.parse(e.target.value);
										setWebhookForm({ ...webhookForm, headers: parsed });
									} catch (err) {
										// Allow invalid JSON while typing
									}
								}}
								placeholder={'{\n  "Authorization": "Bearer token",\n  "Content-Type": "application/json"\n}'}
								rows={4}
							/>
						</div>

						<div>
							<Label htmlFor="webhook-payload">{t('integrations.payload', 'Payload (JSON)')}</Label>
							<Textarea
								id="webhook-payload"
								value={webhookForm.payload ? JSON.stringify(webhookForm.payload, null, 2) : '{}'}
								onChange={(e) => {
									try {
										const parsed = JSON.parse(e.target.value);
										setWebhookForm({ ...webhookForm, payload: parsed });
									} catch (err) {
										// Allow invalid JSON while typing
									}
								}}
								placeholder={'{\n  "event": "task.created",\n  "task_id": "{{task.id}}"\n}'}
								rows={6}
							/>
						</div>

						<div>
							<Label htmlFor="webhook-timeout">{t('integrations.timeout', 'Timeout (seconds)')}</Label>
							<Input
								id="webhook-timeout"
								type="number"
								value={webhookForm.timeout}
								onChange={(e) => setWebhookForm({ ...webhookForm, timeout: parseInt(e.target.value) || 10 })}
								placeholder="10"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setIsWebhookDialogOpen(false)}>
							{t('common.cancel', 'Cancel')}
						</Button>
						<Button onClick={handleSaveWebhook}>
							{editingWebhook ? t('common.save', 'Save') : t('common.create', 'Create')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* API Key Dialog */}
			<Dialog open={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>
							{editingApiKey
								? t('integrations.editApiKey', 'Edit API Key')
								: t('integrations.addApiKey', 'Add API Key')}
						</DialogTitle>
						<DialogDescription>
							{t('integrations.apiKeyDialogDescription', 'Create an API key for programmatic access')}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div>
							<Label htmlFor="api-key-name">{t('integrations.name', 'Name')} *</Label>
							<Input
								id="api-key-name"
								value={apiKeyForm.name}
								onChange={(e) => setApiKeyForm({ ...apiKeyForm, name: e.target.value })}
								placeholder={t('integrations.apiKeyNamePlaceholder', 'My API Key')}
								required
							/>
						</div>

						{editingApiKey && (
							<div>
								<Label htmlFor="api-key-value">{t('integrations.key', 'API Key')}</Label>
								<Input
									id="api-key-value"
									value={editingApiKey.key}
									readOnly
									className="font-mono"
								/>
								<p className="text-xs text-muted-foreground mt-1">
									{t('integrations.apiKeyWarning', 'Keep this key secure. It cannot be retrieved after creation.')}
								</p>
							</div>
						)}
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setIsApiKeyDialogOpen(false)}>
							{t('common.cancel', 'Cancel')}
						</Button>
						<Button onClick={handleSaveApiKey}>
							{editingApiKey ? t('common.save', 'Save') : t('common.create', 'Create')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default Integrations;
