import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiagramProject } from "@fortawesome/free-solid-svg-icons";
import { SettingsLayout } from "../components";

function Workflows() {
  return (
    <SettingsLayout
      title="Workflows"
      description="Design and automate workflows"
      icon={faDiagramProject}
      iconColor="#06b6d4"
      backPath="/settings"
    >
      <div className="mt-4 text-sm text-muted-foreground">
        Workflows configuration coming soon.
      </div>
    </SettingsLayout>
  );
}

export default Workflows;
