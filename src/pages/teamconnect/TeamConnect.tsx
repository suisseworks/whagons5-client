import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

function TeamConnect() {
	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">TeamConnect</h1>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Welcome to TeamConnect</CardTitle>
					<CardDescription>Team collaboration and directory integration</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-sm text-muted-foreground">
						Setup and features coming soon.
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

export default TeamConnect;


