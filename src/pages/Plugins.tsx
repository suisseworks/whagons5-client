import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBroom, faBoxesStacked, faUsers, faDollarSign, faWarehouse } from '@fortawesome/free-solid-svg-icons';

function Plugins() {
	const navigate = useNavigate();
	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Plugins</h1>
				<button className="text-sm underline" onClick={() => navigate(-1)}>Back</button>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
				<Card className="cursor-pointer transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[160px] overflow-hidden">
					<CardHeader className="space-y-3">
						<div className="flex items-center justify-between">
							<div className="text-4xl text-emerald-500 group-hover:scale-110 transition-transform duration-200">
								<FontAwesomeIcon icon={faBroom} />
							</div>
						</div>
						<div className="space-y-1.5">
							<CardTitle className="text-2xl">Cleaning</CardTitle>
							<CardDescription>Cleaning workflows, schedules and services</CardDescription>
						</div>
					</CardHeader>
				</Card>

				<Card className="cursor-pointer transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[160px] overflow-hidden">
					<CardHeader className="space-y-3">
						<div className="flex items-center justify-between">
							<div className="text-4xl text-sky-500 group-hover:scale-110 transition-transform duration-200">
								<FontAwesomeIcon icon={faBoxesStacked} />
							</div>
						</div>
						<div className="space-y-1.5">
							<CardTitle className="text-xl">Assets</CardTitle>
							<CardDescription>Asset tracking, inspections and maintenance</CardDescription>
						</div>
					</CardHeader>
				</Card>

				<Card className="cursor-pointer transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[160px] overflow-hidden">
					<CardHeader className="space-y-3">
						<div className="flex items-center justify-between">
							<div className="text-4xl text-violet-500 group-hover:scale-110 transition-transform duration-200">
								<FontAwesomeIcon icon={faUsers} />
							</div>
						</div>
						<div className="space-y-1.5">
							<CardTitle className="text-xl">TeamConnect</CardTitle>
							<CardDescription>Team collaboration and directory integration</CardDescription>
						</div>
					</CardHeader>
				</Card>

				<Card className="cursor-pointer transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[160px] overflow-hidden">
					<CardHeader className="space-y-3">
						<div className="flex items-center justify-between">
							<div className="text-4xl text-amber-500 group-hover:scale-110 transition-transform duration-200">
								<FontAwesomeIcon icon={faDollarSign} />
							</div>
						</div>
						<div className="space-y-1.5">
							<CardTitle className="text-xl">Costs</CardTitle>
							<CardDescription>Cost management, budgeting and reporting</CardDescription>
						</div>
					</CardHeader>
				</Card>

				<Card className="cursor-pointer transition-all duration-200 group select-none hover:shadow-lg hover:scale-[1.02] h-[160px] overflow-hidden">
					<CardHeader className="space-y-3">
						<div className="flex items-center justify-between">
							<div className="text-4xl text-teal-500 group-hover:scale-110 transition-transform duration-200">
								<FontAwesomeIcon icon={faWarehouse} />
							</div>
						</div>
						<div className="space-y-1.5">
							<CardTitle className="text-xl">Inventory management</CardTitle>
							<CardDescription>Track stock levels, manage inventory and optimize supply chains</CardDescription>
						</div>
					</CardHeader>
				</Card>
			</div>
		</div>
	);
}

export default Plugins;
