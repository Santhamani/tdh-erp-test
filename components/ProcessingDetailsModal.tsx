import React, { useEffect } from 'react';
import type { LogEntry } from '../types';
import { PROCESSING_STAGE_COLUMNS } from '../constants';

interface ProcessingDetailsModalProps {
    log: LogEntry;
    onClose: () => void;
}

export const ProcessingDetailsModal: React.FC<ProcessingDetailsModalProps> = ({ log, onClose }) => {
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

    const getCellValue = (rowIndex: number, colIndex: number) => {
        return details[`stage_row_${rowIndex}_col_${colIndex}`] || 'N/A';
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl animate-fade-in max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="p-6 border-b flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Processing Details</h2>
                        <p className="text-sm text-slate-500">
                            Vehicle <span className="font-semibold">{details.vehicle_number?.toUpperCase() || 'N/A'}</span> on {new Date(log.timestamp).toLocaleString()}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-full p-2 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Vehicle Number</p>
                            <p className="text-sm text-slate-800">{details.vehicle_number?.toUpperCase() || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Brand</p>
                            <p className="text-sm text-slate-800">{details.brand || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Product Name</p>
                            <p className="text-sm text-slate-800">{details.product_name || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Operator</p>
                            <p className="text-sm text-slate-800">{log.userName || log.userId}</p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-700 border-b pb-2 mb-3">Stage Table</h3>
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                    <tr>
                                        {PROCESSING_STAGE_COLUMNS.map(col => (
                                            <th key={col} className="p-3 whitespace-nowrap">{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[1, 2].map(rowIndex => (
                                        <tr key={`row-${rowIndex}`} className="border-t">
                                            {PROCESSING_STAGE_COLUMNS.map((col, colIndex) => (
                                                <td key={`${rowIndex}-${colIndex}`} className="p-3 text-slate-700">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${rowIndex === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                            {rowIndex === 1 ? '+' : '-'}
                                                        </span>
                                                        <span>{getCellValue(rowIndex, colIndex + 1)}</span>
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-b-2xl flex justify-end">
                    <button onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300 transition">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
