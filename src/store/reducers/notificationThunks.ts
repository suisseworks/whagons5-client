import { createAsyncThunk } from "@reduxjs/toolkit";
import { DB } from "../indexedDB/DB";
import { genericInternalActions } from "../genericSlices";

/**
 * Cleanup expired notifications (viewed more than 24 hours ago)
 * Opens DB, finds expired IDs by viewed_at > 24h, performs store.delete
 * for each id in a single transaction, then dispatches getFromIndexedDB
 */
export const cleanupExpiredNotifications = createAsyncThunk(
    'notifications/cleanupExpired',
    async (_, { dispatch, rejectWithValue }) => {
        try {
            if (!DB.inited || !DB.db) {
                return rejectWithValue('Database not initialized');
            }

            const now = Date.now();
            const tx = DB.db.transaction(['notifications'], 'readwrite');
            const store = tx.objectStore('notifications');

            // Get all notifications
            const allNotifs = await new Promise<any[]>((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });

            // Delete notifications that were viewed more than 24 hours ago
            const expiredIds = allNotifs
                .filter(n => n.viewed_at && (now - new Date(n.viewed_at).getTime()) >= (24 * 60 * 60 * 1000))
                .map(n => n.id);

            if (expiredIds.length > 0) {
                // Collect delete request promises
                const deletePromises = expiredIds.map(id => {
                    return new Promise<void>((resolve, reject) => {
                        const request = store.delete(id);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                });

                // Await all delete operations and transaction completion
                const txPromise = new Promise<void>((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                    tx.onabort = () => reject(new Error('Transaction aborted'));
                });

                await Promise.all([...deletePromises, txPromise]);
            }

            // Reload from IndexedDB after transaction completes
            await dispatch(genericInternalActions.notifications.getFromIndexedDB({ force: true }) as any);

            return { deletedCount: expiredIds.length };
        } catch (error: any) {
            console.error('Error cleaning up expired notifications:', error);
            return rejectWithValue(error?.message || 'Failed to cleanup expired notifications');
        }
    }
);

/**
 * Mark all notifications as viewed
 * Opens DB, updates all notifications missing viewed_at to now via store.put
 * in one transaction, then dispatches getFromIndexedDB
 */
export const markAllViewedNotifications = createAsyncThunk(
    'notifications/markAllViewed',
    async (notifications: any[], { dispatch, rejectWithValue }) => {
        try {
            if (!DB.db) {
                return rejectWithValue('Database not initialized');
            }

            const now = new Date().toISOString();
            const tx = DB.db.transaction(['notifications'], 'readwrite');
            const store = tx.objectStore('notifications');

            // Queue all put operations without awaiting each one
            for (const notification of notifications) {
                if (!notification.viewed_at) {
                    const updated = { ...notification, viewed_at: now };
                    store.put(updated);
                }
            }

            // Wait for transaction to complete before dispatching
            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(new Error('Transaction aborted'));
            });

            // Reload from IndexedDB after transaction completes
            await dispatch(genericInternalActions.notifications.getFromIndexedDB({ force: true }) as any);

            return { markedCount: notifications.filter(n => !n.viewed_at).length };
        } catch (error: any) {
            console.error('Error marking notifications as viewed:', error);
            return rejectWithValue(error?.message || 'Failed to mark notifications as viewed');
        }
    }
);
