import React from "react";
import { SettingsLayout } from "@/pages/settings/components/SettingsLayout";
import { faSquareCheck } from "@fortawesome/free-solid-svg-icons";

function Approvals() {
  return (
    <div className="p-4 pt-0 h-full">
      <SettingsLayout
        title="Approvals"
        description="Configure task approvals"
        icon={faSquareCheck}
        iconColor="#10b981"
        wrapChildrenFullHeight={false}
      >
        <div className="text-sm text-muted-foreground">
          Approvals settings will be available here.
        </div>
      </SettingsLayout>
    </div>
  );
}

export default Approvals;


