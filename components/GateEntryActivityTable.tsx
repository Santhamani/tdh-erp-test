import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { collection, query, orderBy, onSnapshot, Timestamp, doc, updateDoc } from 'firebase/firestore';
import type { User, LogEntry } from '../types';
import { GateEntryDetailsModal } from './GateEntryDetailsModal';
import { USE_MYSQL } from '../services/appConfig';
import { mysqlApi } from '../services/mysqlApi';

type TimeFilter = '24h' | 'week' | 'month' | 'custom';

// Helper to get nested property
const getNested = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

export const GateEntryActivityTable: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [gateRecords, setGateRecords] = useState<LogEntry[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<LogEntry | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isUpdating, setIsUpdating] = useState(false);

    const canManageRecords = currentUser?.role === 'MANAGER' || currentUser?.role === 'ADMIN';

    useEffect(() => {
        if (!currentUser) {
            setGateRecords([]);
            return;
        }

        if (USE_MYSQL) {
            let cancelled = false;

            const load = async () => {
                try {
                    const records = await mysqlApi.getArrivalRecords();
                    if (cancelled) return;
                    const isAdmin = currentUser?.role === 'ADMIN';
                    setGateRecords(isAdmin ? records : records.filter((r) => !r.deleted));
                } catch (error) {
                    if (!cancelled) console.error('Error fetching arrival records from API: ', error);
                }
            };

            const interval = setInterval(load, 15000);
            load();

            return () => {
                cancelled = true;
                clearInterval(interval);
            };
        }

        const q = query(collection(db, "arrival_records"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const records: LogEntry[] = querySnapshot.docs.map(doc => {
                const data = doc.data();
                const timestamp = data.timestamp instanceof Timestamp
                    ? data.timestamp.toDate().toISOString()
                    : data.timestamp;
                
                return {
                    id: doc.id,
                    timestamp: timestamp,
                    userId: data.userId,
                    userName: data.userName,
                    action: data.action || 'arrival_RECORDED',
                    details: data.details || data, // IMPORTANT: Ensure details object exists
                    active: data.active !== false, // Default to true if not set
                    deleted: data.deleted === true, // Track deleted state
                } as LogEntry;
            });
            // For managers: filter out deleted records. For admins: show all records
            const isAdmin = currentUser?.role === 'ADMIN';
            setGateRecords(isAdmin ? records : records.filter(r => !r.deleted));
        }, (error) => {
            console.error("Error fetching arrival records: ", error);
        });

        return () => unsubscribe();
    }, [currentUser, canManageRecords]);

    const filteredRecords = useMemo(() => {
        return (gateRecords || []).filter(record => {
            // Managers should never see deleted records
            if (currentUser?.role === 'MANAGER' && record.deleted) return false;
            
            if (!record.timestamp || typeof record.details !== 'object') return false;
            
            const recordDate = new Date(record.timestamp);
            let timeMatch = false;
            switch (timeFilter) {
                case '24h':
                    timeMatch = (new Date().getTime() - recordDate.getTime()) < 24 * 60 * 60 * 1000;
                    break;
                case 'week':
                    timeMatch = (new Date().getTime() - recordDate.getTime()) < 7 * 24 * 60 * 60 * 1000;
                    break;
                case 'month':
                    timeMatch = (new Date().getTime() - recordDate.getTime()) < 30 * 24 * 60 * 60 * 1000;
                    break;
                case 'custom':
                     if (!customStartDate && !customEndDate) {
                        timeMatch = true;
                        break;
                    }
                    const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : null;
                    const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : null;
                    if (start && end) timeMatch = recordDate >= start && recordDate <= end;
                    else if (start) timeMatch = recordDate >= start;
                    else if (end) timeMatch = recordDate <= end;
                    break;
                default: timeMatch = true;
            }
            if (!timeMatch) return false;

            if (searchTerm.trim() === '') return true;
            const lowercasedSearch = searchTerm.toLowerCase();
            const uppercasedSearch = searchTerm.toUpperCase();
            
            // Access data from the details object
            const details = record.details as Record<string, any>;
            return (
                details.vehicle_number?.toUpperCase().includes(uppercasedSearch) ||
                details.driver_name?.toLowerCase().includes(lowercasedSearch) ||
                details.challan_number?.toLowerCase().includes(lowercasedSearch)
            );
        });
    }, [gateRecords, searchTerm, timeFilter, customStartDate, customEndDate, currentUser?.role]);

    const formatTimestamp = (isoString: string) => new Date(isoString).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredRecords.length && filteredRecords.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredRecords.map(r => r.id)));
        }
    };

    const deleteRecords = async () => {
        if (selectedIds.size === 0) return;
        
        setIsUpdating(true);
        try {
            const updatePromises = Array.from(selectedIds).map((id) => {
                if (USE_MYSQL) return mysqlApi.softDeleteArrival(id);
                return updateDoc(doc(db, 'arrival_records', id), { deleted: true });
            });
            await Promise.all(updatePromises);
            setSelectedIds(new Set());
        } catch (error) {
            console.error('Error deleting records:', error);
            alert('Failed to delete records. Please try again.');
        } finally {
            setIsUpdating(false);
        }
    };

    const FilterButton: React.FC<{ filter: TimeFilter; label: string }> = ({ filter, label }) => (
        <button
            onClick={() => setTimeFilter(filter)}
            className={`flex-1 text-center px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${timeFilter === filter ? 'bg-red-600 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="bg-white p-6 rounded-lg shadow-md w-full">
             <h3 className="text-xl font-semibold text-slate-700 mb-4">Recent Gate Activity</h3>
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 space-y-4 md:space-y-0">
                <div className="relative w-full md:max-w-xs">
                     <input
                        type="text"
                        placeholder="Search by vehicle, driver..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:flex gap-2 p-1 bg-slate-100 rounded-lg w-full md:w-auto">
                    <FilterButton filter="24h" label="Last 24h" />
                    <FilterButton filter="week" label="This Week" />
                    <FilterButton filter="month" label="This Month" />
                    <FilterButton filter="custom" label="Custom" />
                </div>
            </div>

            {timeFilter === 'custom' && (
                 <div className="flex flex-col sm:flex-row items-center gap-2 mb-4 p-2 bg-slate-50 rounded-lg justify-center">
                    <label htmlFor="start-date" className="text-sm font-medium text-slate-600">From:</label>
                    <input id="start-date" type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="px-3 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-red-500"/>
                    <label htmlFor="end-date" className="text-sm font-medium text-slate-600">To:</label>
                    <input id="end-date" type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="px-3 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-red-500"/>
                    <button onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-md hover:bg-gray-300 transition">Clear</button>
                </div>
            )}

            <div className="overflow-x-auto">
                {canManageRecords && filteredRecords.length > 0 && (
                    <div className="mb-4 flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-700">
                            {selectedIds.size} selected
                        </span>
                        <button
                            onClick={deleteRecords}
                            disabled={selectedIds.size === 0 || isUpdating}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                            {isUpdating ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                )}
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                            {canManageRecords && (
                                <th className="p-3 w-12">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                    />
                                </th>
                            )}
                            <th className="p-3">Mode</th>
                            <th className="p-3">Vehicle No</th>
                            <th className="p-3">From</th>
                            <th className="p-3">Party</th>
                            <th className="p-3">Bags</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRecords.length > 0 ? filteredRecords.map(record => {
                             if (typeof record.details !== 'object' || record.details === null) return (
                                <tr key={record.id}><td colSpan={canManageRecords ? 8 : 7} className="text-center p-4 text-red-500">Invalid record data</td></tr>
                            );
                            const details = record.details as Record<string, any>;
                            const isOut = details.gate_mode === 'out';
                            const isInactive = record.active === false;
                            return (
                                <tr key={record.id} className={`border-b hover:bg-slate-50 ${isInactive ? 'bg-gray-100 opacity-60' : ''}`}>
                                    {canManageRecords && (
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(record.id)}
                                                onChange={() => toggleSelection(record.id)}
                                                className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                            />
                                        </td>
                                    )}
                                    <td className="p-3">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase ${isOut ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                            {details.gate_mode}
                                        </span>
                                    </td>
                                    <td className="p-3 font-medium text-slate-800">
                                        {details.vehicle_number?.toUpperCase()}
                                        {record.deleted && <span className="ml-2 text-xs text-red-600 font-semibold">(deleted)</span>}
                                    </td>
                                    <td className="p-3">{details.from_location}</td>
                                    <td className="p-3">{details.party}</td>
                                    <td className="p-3">{details.bags}</td>
                                    <td className="p-3">
                                        <button onClick={() => setSelectedRecord(record)} className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full hover:bg-red-200 transition">
                                            Details
                                        </button>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={canManageRecords ? 7 : 6} className="text-center p-8 text-slate-500">No entries found for the selected criteria.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {selectedRecord && (
                <GateEntryDetailsModal 
                    log={selectedRecord} // Pass the entire record as the 'log' prop
                    onClose={() => setSelectedRecord(null)}
                />
            )}
        </div>
    );
};