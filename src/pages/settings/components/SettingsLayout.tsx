import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  search?: {
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
  };
  children: React.ReactNode;
  headerActions?: React.ReactNode;
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
  // If true (default), children are wrapped to fill available height; when false, children size naturally
  wrapChildrenFullHeight?: boolean;
}

export function SettingsLayout({
  title,
  description,
  icon,
  iconColor,
  children,
  headerActions,
  loading,
  error,
  statistics,
  showGrid = false,
  gridComponent,
  beforeContent,
  afterContent,
  wrapChildrenFullHeight = true
}: SettingsLayoutProps) {

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-3 bg-background">
      {/* Title and Actions Row - No Breadcrumbs Here */}
      <div className="py-4 flex-shrink-0 border-b border-border/40">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Title and Icon */}
          <div className="flex items-start space-x-4 min-w-0 flex-1">
            <div className="flex-shrink-0 mt-1">
              <FontAwesomeIcon
                icon={icon}
                className="text-3xl"
                style={iconColor ? { color: iconColor } : {}}
              />
            </div>
            <div className="flex flex-col items-start min-w-0 flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground/80 leading-relaxed mt-2 max-w-2xl" title={description}>
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {headerActions && (
              <div>
                {headerActions}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 min-h-0 flex flex-col ${wrapChildrenFullHeight ? 'overflow-hidden' : 'overflow-auto'} space-y-3`}>
        {beforeContent}

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
            {/* Grid/content zone */}
            <div className={`flex-1 min-h-0 ${wrapChildrenFullHeight ? 'overflow-hidden' : 'overflow-auto'}`}>
              {showGrid && gridComponent ? (
                <div className="h-full">
                  {gridComponent}
                </div>
              ) : wrapChildrenFullHeight ? (
                <div className="h-full">
                  {children}
                </div>
              ) : (
                <div className="">
                  {children}
                </div>
              )}
            </div>
          </>
        )}

        {afterContent}

        {statistics && !loading?.isLoading && !error && (
          <>
            <Card className="flex-shrink-0">
              <CardHeader className="py-1">
                <CardTitle className="text-sm">{statistics.title}</CardTitle>
                {statistics.description && (
                  <CardDescription className="text-[11px] text-muted-foreground/70">
                    {statistics.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="py-2">
                <div className={`grid grid-cols-1 gap-2 ${
                  statistics.items.length <= 3 
                    ? 'md:grid-cols-3' 
                    : statistics.items.length === 4 
                    ? 'md:grid-cols-2 lg:grid-cols-4'
                    : 'md:grid-cols-3'
                }`}>
                  {statistics.items.map((item, index) => (
                    <div key={index} className="text-center">
                      <div className="text-base font-semibold leading-none">{item.value}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">{item.label}</div>
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
