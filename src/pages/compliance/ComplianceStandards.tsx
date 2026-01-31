import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { genericActions } from '@/store/genericSlices';
import { RootState } from '@/store/store';
import { AppDispatch } from '@/store/store';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

export const ComplianceStandards = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { value: standards, loading } = useSelector((state: RootState) => state.complianceStandards);


    return (
        <PageContainer title="Standards and Norms">
            <div className="flex justify-end mb-4">
                <Button>Add Standard</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Standards</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Authority</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
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
                                            {standard.active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Link to={`/compliance/standards/${standard.id}`}>
                                            <Button variant="ghost" size="sm">View</Button>
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


