import { useNavigate } from 'react-router-dom';

function Plugins() {
	const navigate = useNavigate();
	return (
		<div className="p-6 space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Plugins</h1>
				<button className="text-sm underline" onClick={() => navigate(-1)}>Back</button>
			</div>
			<p className="text-muted-foreground">Coming soon</p>
		</div>
	);
}

export default Plugins;
