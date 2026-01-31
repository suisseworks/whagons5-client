import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { genericInternalActions } from '@/store/genericSlices';
import { RootState } from '@/store/store';
import { AppDispatch } from '@/store/store';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/providers/LanguageProvider';

export const ComplianceStandards = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { value: standards, loading } = useSelector((state: RootState) => state.complianceStandards);
    const { t } = useLanguage();

    useEffect(() => {
        // First try to get from IndexedDB (fast)
        dispatch(genericInternalActions.complianceStandards.getFromIndexedDB());
        // Then fetch from API to ensure we have latest data
        dispatch(genericInternalActions.complianceStandards.fetchFromAPI());
    }, [dispatch]);

    return (
        <PageContainer title={t('compliance.standards.title', 'Standards and Norms')}>
            <div className="flex justify-end mb-4">
                <Button>{t('compliance.standards.addStandard', 'Add Standard')}</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('compliance.standards.table.title', 'Standards')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('compliance.standards.table.columns.code', 'Code')}</TableHead>
                                <TableHead>{t('compliance.standards.table.columns.name', 'Name')}</TableHead>
                                <TableHead>{t('compliance.standards.table.columns.authority', 'Authority')}</TableHead>
                                <TableHead>{t('compliance.standards.table.columns.status', 'Status')}</TableHead>
                                <TableHead>{t('compliance.standards.table.columns.actions', 'Actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {standards.map((standard: any) => (
                                <TableRow key={standard.id}>
                                    <TableCell className="font-medium">{standard.code}</TableCell>
                                    <TableCell>{standard.name}</TableCell>
                                    <TableCell>{standard.authority}</TableCell>
                                    <TableCell>
                                        <Badge variant={standard.active ? 'default' : 'secondary'}>
                                            {standard.active 
                                                ? t('compliance.standards.status.active', 'Active')
                                                : t('compliance.standards.status.inactive', 'Inactive')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Link to={`/compliance/standards/${standard.id}`}>
                                            <Button variant="ghost" size="sm">
                                                {t('compliance.standards.actions.view', 'View')}
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </PageContainer>
    );
};


