import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faChartLine } from "@fortawesome/free-solid-svg-icons";

function Analytics() {
  const navigate = useNavigate();

  const handleBackClick = () => {
    navigate('/');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <button 
            onClick={handleBackClick}
            className="flex items-center space-x-1 hover:text-foreground transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
            <span>Back</span>
          </button>
          <span>»</span>
          <span className="text-foreground">Analytics</span>
        </nav>
        <div className="flex items-center space-x-3">
          <FontAwesomeIcon icon={faChartLine} className="text-blue-500 text-2xl" />
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        </div>
        <p className="text-muted-foreground">
          Insights and metrics across your workspaces.
        </p>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>
              This module will provide KPIs, trends, and dashboards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-sm">
              Placeholder page. We can wire charts and filters here.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Analytics;


