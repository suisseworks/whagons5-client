import React from 'react';
import { Separator } from '@/components/ui/separator';

interface PageContainerProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}

export const PageContainer = ({ title, subtitle, children }: PageContainerProps) => {
    return (
        <div className="p-6 space-y-6">
            <div className="space-y-0.5">
                <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                {subtitle && (
                    <p className="text-muted-foreground">
                        {subtitle}
                    </p>
                )}
            </div>
            <Separator className="my-6" />
            <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
                <div className="flex-1 lg:max-w-full">{children}</div>
            </div>
        </div>
    );
};

