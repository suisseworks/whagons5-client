import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { genericActions } from '@/store/genericSlices';
import { RootState } from '@/store/store';
import { AppDispatch } from '@/store/store';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useParams } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const ComplianceStandardDetail = () => {
    const { id } = useParams();
    const dispatch = useDispatch<AppDispatch>();
    const standardId = parseInt(id || '0');
    
    const standard = useSelector((state: RootState) => 
        state.complianceStandards.value.find((s: any) => s.id === standardId)
    );

    const requirements = useSelector((state: RootState) => 
        state.complianceRequirements.value.filter((r: any) => r.standard_id === standardId)
    );


    if (!standard) return <div>Loading...</div>;

    // Build Requirement Tree
    const rootRequirements = requirements.filter((r: any) => !r.parent_id).sort((a: any, b: any) => a.clause_number.localeCompare(b.clause_number));
    
    const renderRequirement = (req: any) => {
        const children = requirements.filter((r: any) => r.parent_id === req.id).sort((a: any, b: any) => a.clause_number.localeCompare(b.clause_number));
        
        return (
            <div key={req.id} className="mb-4 border-l-2 border-gray-200 pl-4 ml-2">
                <div className="flex items-start justify-between group">
                    <div>
                        <h4 className="text-sm font-bold text-gray-900">{req.clause_number} {req.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{req.description}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">Map Evidence</Button>
                </div>
                
                {children.length > 0 && (
                    <div className="mt-4">
                        {children.map(renderRequirement)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <PageContainer title={standard.code} subtitle={standard.name}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Info */}
                <div className="md:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Standard Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="text-sm font-medium text-gray-500">Authority</div>
                                <div>{standard.authority}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-500">Version</div>
                                <div>{standard.version}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-500">Description</div>
                                <div className="text-sm">{standard.description}</div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Audit Status</CardTitle>
                            <CardDescription>Current compliance level</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-4">
                                <div className="text-3xl font-bold text-green-600">0%</div>
                                <div className="text-xs text-gray-500">Requirements Covered</div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Requirements Tree */}
                <div className="md:col-span-2">
                    <Card className="h-full">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Requirements & Clauses</CardTitle>
                            <Button variant="outline" size="sm">Expand All</Button>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[600px] pr-4">
                                {rootRequirements.map(renderRequirement)}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageContainer>
    );
};


