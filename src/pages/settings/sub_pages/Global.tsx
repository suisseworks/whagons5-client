import { faGlobe } from "@fortawesome/free-solid-svg-icons";
import SettingsLayout from "../components/SettingsLayout";

function Global() {
  return (
    <SettingsLayout
      title="Global Settings"
      description="Organization-wide defaults and application configuration"
      icon={faGlobe}
      iconColor="#0ea5e9"
    >
      <div className="p-4 text-sm text-muted-foreground">
        Global settings placeholder. Configure app-wide defaults here.
      </div>
    </SettingsLayout>
  );
}

export default Global;


