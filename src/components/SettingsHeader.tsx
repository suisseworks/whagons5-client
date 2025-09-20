import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";

type SettingsHeaderProps = {
  title: string;
  sectionLabel: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  onBack?: () => void;
};

export default function SettingsHeader({
  title,
  sectionLabel,
  subtitle,
  icon,
  actions,
  onBack,
}: SettingsHeaderProps) {
  const navigate = useNavigate();

  const handleBack = React.useCallback(() => {
    if (onBack) return onBack();
    navigate("/settings");
  }, [navigate, onBack]);

  return (
    <div className="space-y-2 py-6 border-b border-border">
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <button
          onClick={handleBack}
          className="flex items-center space-x-1 hover:text-foreground hover:underline transition-colors cursor-pointer"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
          <span>Settings</span>
        </button>
        <span>{">"}</span>
        <span className="text-foreground">{sectionLabel}</span>
      </nav>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            {icon}
            <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
          </div>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center space-x-1">{actions}</div> : null}
      </div>
    </div>
  );
}


