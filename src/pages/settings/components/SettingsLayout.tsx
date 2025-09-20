import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface StatisticItem {
  label: string;
  value: string | number;
}

export interface SettingsLayoutProps {
  title: string;
  description: string;
  icon: IconDefinition;
  iconColor?: string;
  backPath?: string;
  breadcrumbs?: Array<{ label: string; path?: string }>;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  // Enhanced features
  search?: {
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
  };
  loading?: {
    isLoading: boolean;
    message?: string;
  };
  error?: {
    message: string;
    onRetry?: () => void;
  };
  statistics?: {
    title: string;
    description?: string;
    items: StatisticItem[];
  };
  // Grid support
  showGrid?: boolean;
  gridComponent?: React.ReactNode;
  // Additional content sections
  beforeContent?: React.ReactNode;
  afterContent?: React.ReactNode;
}

export function SettingsLayout({
  title,
  description,
  icon,
  iconColor,
  backPath = '/settings',
  breadcrumbs,
  children,
  headerActions,
  search,
  loading,
  error,
  statistics,
  showGrid = false,
  gridComponent,
  beforeContent,
  afterContent
}: SettingsLayoutProps) {
  const navigate = useNavigate();

  const handleBackClick = () => {
    navigate(backPath);
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="space-y-2 py-6 border-b border-border">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <button
            onClick={handleBackClick}
            className="flex items-center space-x-1 hover:text-foreground hover:underline transition-colors cursor-pointer"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
            <span>Settings</span>
          </button>
          {breadcrumbs && breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              <span>{'>'}</span>
              {crumb.path ? (
                <button
                  onClick={() => navigate(crumb.path!)}
                  className="hover:text-foreground hover:underline transition-colors cursor-pointer"
                >
                  {crumb.label}
                </button>
              ) : (
                <span>{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
          <span>{'>'}</span>
          <span className="text-foreground">{title}</span>
        </nav>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <FontAwesomeIcon 
                icon={icon} 
                className="text-2xl" 
                style={iconColor ? { color: iconColor } : {}}
              />
              <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
            </div>
            <p className="text-xs text-muted-foreground/60 leading-relaxed">{description}</p>
          </div>
          <div className="flex items-center space-x-2">
            {headerActions && (
              <div>
                {headerActions}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {beforeContent}
        
        {/* Search bar - always below header when provided */}
        {search && !loading?.isLoading && !error && (
          <div className="space-y-4">
            <Input
              placeholder={search.placeholder || "Search..."}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              className="w-full max-w-md"
            />
          </div>
        )}
        
        {loading?.isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              <span>{loading.message || 'Loading...'}</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <p className="text-destructive">{error.message}</p>
            {error.onRetry && (
              <Button onClick={error.onRetry} variant="outline">
                Try Again
              </Button>
            )}
          </div>
        ) : (
          <>
            {showGrid && gridComponent && (
              <div className="space-y-4">
                {gridComponent}
              </div>
            )}
            {children}
          </>
        )}

        {afterContent}

        {statistics && !loading?.isLoading && !error && (
          <>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{statistics.title}</CardTitle>
                {statistics.description && (
                  <CardDescription className="text-muted-foreground/70">
                    {statistics.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className={`grid grid-cols-1 gap-4 ${
                  statistics.items.length <= 3 
                    ? 'md:grid-cols-3' 
                    : statistics.items.length === 4 
                    ? 'md:grid-cols-2 lg:grid-cols-4'
                    : 'md:grid-cols-3'
                }`}>
                  {statistics.items.map((item, index) => (
                    <div key={index} className="text-center">
                      <div className="text-2xl font-bold">{item.value}</div>
                      <div className="text-sm text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export default SettingsLayout;
