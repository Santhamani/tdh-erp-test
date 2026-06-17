import React, { useEffect, useMemo, useState } from 'react';
import type { LogEntry } from '../types';
import { db } from '../firebase/firebase';
import { doc, updateDoc } from 'firebase/firestore';

type SalesRow = Record<string, string>;

const monthMap: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12'
};

const normalizeDateForInput = (value: string) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
    }

    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const yearRaw = dmyMatch[3];
        const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
        return `${year}-${month}-${day}`;
    }

    const monMatch = trimmed.match(/^(\d{1,2})[\-\s]([A-Za-z]{3})[\-\s](\d{2,4})$/);
    if (monMatch) {
        const day = monMatch[1].padStart(2, '0');
        const month = monthMap[monMatch[2].toLowerCase()] || '01';
        const yearRaw = monMatch[3];
        const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
        return `${year}-${month}-${day}`;
    }

    return '';
};

interface SalesDetailsModalProps {
    log: LogEntry;
    onClose: () => void;
}

export const SalesDetailsModal: React.FC<SalesDetailsModalProps> = ({ log, onClose }) => {
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (typeof log.details !== 'object' || log.details === null) {
        return null;
    }

    const details = (log.details as any).submittedData ?? log.details;
    const columns: string[] = details.columns || [];
    const initialRows: SalesRow[] = details.rows || [];

    const [rows, setRows] = useState<SalesRow[]>(() => initialRows.map(row => ({ ...row })));
    const [dateFilter, setDateFilter] = useState('');
    const [brandFilter, setBrandFilter] = useState('');
    const [itemFilter, setItemFilter] = useState('');
    const [qtlFilter, setQtlFilter] = useState('');
    const [bagsFilter, setBagsFilter] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    const columnMap = useMemo(() => {
        const normalized = columns.map(col => col.toLowerCase());
        const findKey = (candidates: string[]) => {
            const index = normalized.findIndex(col => candidates.some(candidate => col.includes(candidate)));
            return index >= 0 ? columns[index] : '';
        };
        return {
            date: findKey(['date']),
            brand: findKey(['brand']),
            item: findKey(['item']),
            qtl: findKey(['qtl', 'quantity']),
            bags: findKey(['bag'])
        };
    }, [columns]);

    const filteredRows = useMemo(() => {
        const matches = (row: SalesRow, key: string, filter: string) => {
            if (!filter.trim()) return true;
            if (!key) return false;
            return String(row[key] || '').toLowerCase().includes(filter.toLowerCase());
        };

        return rows.filter(row => (
            matches(row, columnMap.date, dateFilter) &&
            matches(row, columnMap.brand, brandFilter) &&
            matches(row, columnMap.item, itemFilter) &&
            matches(row, columnMap.qtl, qtlFilter) &&
            matches(row, columnMap.bags, bagsFilter)
        ));
    }, [rows, columnMap, dateFilter, brandFilter, itemFilter, qtlFilter, bagsFilter]);

    const handleCellChange = (rowIndex: number, column: string, value: string) => {
        setRows(prev => {
            const next = prev.map(row => ({ ...row }));
            next[rowIndex][column] = value;
            return next;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveMessage('');
        try {
            await updateDoc(doc(db, 'sales_records', log.id), {
                'details.rows': rows,
                'details.columns': columns
            });
            setSaveMessage('Changes saved.');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Failed to save sales details:', error);
            setSaveMessage('Failed to save changes.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl animate-fade-in max-h-[85vh] flex flex-col overflow-hidden mt-6"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="p-6 border-b flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Sales Details</h2>
                        <p className="text-sm text-slate-500">
                            File <span className="font-semibold">{details.file_name || 'Sales Upload'}</span> on {new Date(log.timestamp).toLocaleString()}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-full p-2 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-6 flex-1 min-h-0 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <input
                            type="text"
                            value={brandFilter}
                            onChange={(e) => setBrandFilter(e.target.value)}
                            placeholder="Filter Brand Name"
                            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <input
                            type="text"
                            value={itemFilter}
                            onChange={(e) => setItemFilter(e.target.value)}
                            placeholder="Filter Item Name"
                            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <input
                            type="text"
                            value={qtlFilter}
                            onChange={(e) => setQtlFilter(e.target.value)}
                            placeholder="Filter QTL"
                            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <input
                            type="text"
                            value={bagsFilter}
                            onChange={(e) => setBagsFilter(e.target.value)}
                            placeholder="Filter BAGS"
                            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                    </div>

                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full min-w-[900px] text-sm text-left">
                            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                <tr>
                                    {columns.map(column => (
                                        <th key={column} className="p-3 whitespace-nowrap">{column}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.length > 0 ? filteredRows.map((row, rowIndex) => (
                                    <tr key={`sales-modal-row-${rowIndex}`} className="border-t">
                                        {columns.map(column => (
                                            <td key={`${rowIndex}-${column}`} className="p-2">
                                                <input
                                                    type={column === columnMap.date ? 'date' : 'text'}
                                                    value={
                                                        column === columnMap.date
                                                            ? normalizeDateForInput(row[column] || '')
                                                            : (row[column] || '')
                                                    }
                                                    onChange={(e) => handleCellChange(rowIndex, column, e.target.value)}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={columns.length || 1} className="text-center p-8 text-slate-500">
                                            No entries match the selected filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-b-2xl flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-500">
                        {saveMessage}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            className="bg-red-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-red-700 transition disabled:bg-red-400"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            onClick={onClose}
                            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300 transition"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
