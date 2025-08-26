import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { genericActions } from '@/store/genericSlices';
import { GenericSliceState, SpotCustomField, FormField } from '@/store/types';

/**
 * Example component demonstrating how to use generic slices
 * This shows the pattern for using any generic slice in your components
 */

const GenericSliceExample: React.FC = () => {
    const dispatch = useDispatch();

    // Type the selectors properly
    const spotCustomFields = useSelector((state: any) => state.spotCustomFields as GenericSliceState<SpotCustomField>);
    const formFields = useSelector((state: any) => state.formFields as GenericSliceState<FormField>);

    // Load data on component mount
    useEffect(() => {
        // Load from IndexedDB first (fast)
        dispatch(genericActions.spotCustomFields.getFromIndexedDB());
        dispatch(genericActions.formFields.getFromIndexedDB());

        // Then fetch fresh data from API in background
        dispatch(genericActions.spotCustomFields.fetchFromAPI());
        dispatch(genericActions.formFields.fetchFromAPI());
    }, [dispatch]);

    // Handle manual refresh
    const handleRefresh = () => {
        dispatch(genericActions.spotCustomFields.fetchFromAPI());
        dispatch(genericActions.formFields.fetchFromAPI());
    };

    return (
        <div className="p-4 space-y-6">
            <h2 className="text-2xl font-bold">Generic Slice Example</h2>

            {/* Spot Custom Fields Section */}
            <div className="border rounded p-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Spot Custom Fields</h3>
                    <button
                        onClick={handleRefresh}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        disabled={spotCustomFields.loading}
                    >
                        {spotCustomFields.loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>

                {spotCustomFields.error && (
                    <div className="text-red-500 mb-4">
                        Error: {spotCustomFields.error}
                    </div>
                )}

                {spotCustomFields.loading && spotCustomFields.value.length === 0 && (
                    <div className="text-gray-500">Loading...</div>
                )}

                <div className="space-y-2">
                    {spotCustomFields.value.map((field) => (
                        <div key={field.id} className="border rounded p-2">
                            <div className="font-medium">{field.custom_field_id}</div>
                            <div className="text-sm text-gray-600">
                                Created: {new Date(field.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Form Fields Section */}
            <div className="border rounded p-4">
                <h3 className="text-xl font-semibold mb-4">Form Fields</h3>

                {formFields.error && (
                    <div className="text-red-500 mb-4">
                        Error: {formFields.error}
                    </div>
                )}

                <div className="space-y-2">
                    {formFields.value.map((field) => (
                        <div key={field.id} className="border rounded p-2">
                            <div className="font-medium">{field.label}</div>
                            <div className="text-sm text-gray-600">
                                Type: {field.field_type} | Required: {field.required ? 'Yes' : 'No'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Usage Instructions */}
            <div className="border rounded p-4 bg-gray-50">
                <h3 className="text-lg font-semibold mb-2">Usage Pattern</h3>
                <div className="text-sm space-y-1">
                    <div><strong>1. Import:</strong> <code>import &#123; genericActions &#125; from '@/store/genericSlices';</code></div>
                    <div><strong>2. Select:</strong> <code>useSelector(state => state.yourSliceName);</code></div>
                    <div><strong>3. Load:</strong> <code>dispatch(genericActions.yourSliceName.getFromIndexedDB());</code></div>
                    <div><strong>4. Refresh:</strong> <code>dispatch(genericActions.yourSliceName.fetchFromAPI());</code></div>
                </div>
            </div>
        </div>
    );
};

export default GenericSliceExample;
