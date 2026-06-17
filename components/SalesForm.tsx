import React, { useRef, useState } from 'react';
import { PROCESS_STAGES } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from './Modal';
import * as XLSX from 'xlsx';

type SubmissionProps = {
    onSubmissionSuccess: () => void;
};

type SalesRow = Record<string, string>;

export const SalesForm: React.FC<SubmissionProps> = ({ onSubmissionSuccess }) => {
    const { currentUser, verifyPin, submitStageData } = useAuth() as any;
    const formRef = useRef<HTMLFormElement>(null);
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [submittedData, setSubmittedData] = useState<Record<string, any> | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [now, setNow] = useState(() => new Date());

    const [fileName, setFileName] = useState('');
    const [columns, setColumns] = useState<string[]>([]);
    const [rows, setRows] = useState<SalesRow[]>([]);

    const salesStage = PROCESS_STAGES.find(stage => stage.id === 'sales');
    if (!salesStage) return <p className="text-center text-red-500">Error: Sales stage configuration not found.</p>;

    React.useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const parseWorksheet = async (file: File) => {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rawRows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            raw: false,
            dateNF: 'dd/mm/yyyy'
        }) as Array<any[]>;
        if (!rawRows.length) {
            setColumns([]);
            setRows([]);
            throw new Error('The uploaded file is empty.');
        }

        const headerRow = rawRows[0] || [];
        const headerColumns = headerRow.map((cell, index) => {
            const value = String(cell || '').trim();
            return value || `Column ${index + 1}`;
        });

        const dataRows = rawRows.slice(1).filter(row => row.some(cell => String(cell || '').trim() !== ''));
        const parsedRows = dataRows.map(row => {
            const record: SalesRow = {};
            headerColumns.forEach((column, index) => {
                const cellValue = row[index];
                record[column] = cellValue === undefined || cellValue === null ? '' : String(cellValue).trim();
            });
            return record;
        });

        setColumns(headerColumns);
        setRows(parsedRows);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setErrorMessage('');
        try {
            await parseWorksheet(file);
            setFileName(file.name);
        } catch (err: any) {
            console.error('Failed to parse sales file:', err);
            setErrorMessage(err?.message || 'Failed to parse the uploaded file.');
            setFileName('');
        }
    };

    const handleCellChange = (rowIndex: number, column: string, value: string) => {
        setRows(prev => {
            const next = prev.map(row => ({ ...row }));
            next[rowIndex][column] = value;
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMessage('');

        if (!columns.length || !rows.length) {
            setIsSubmitting(false);
            setErrorMessage('Please upload a valid sales file before submitting.');
            return;
        }

        const dataToSubmit = {
            sales_timestamp: new Date().toISOString(),
            file_name: fileName || 'Sales Upload',
            columns,
            rows
        };

        setSubmittedData(dataToSubmit);
        setIsSubmitting(false);
        setIsPinModalOpen(true);
    };

    const handlePinConfirm = async () => {
        if (!currentUser || !submittedData) return;

        if (verifyPin(pin)) {
            try {
                await submitStageData(salesStage.id, submittedData);
                setSuccessMessage('Sales record submitted successfully!');
                setTimeout(() => setSuccessMessage(''), 5000);
                handleCloseModal();
                setSubmittedData(null);
                formRef.current?.reset();
                setFileName('');
                setColumns([]);
                setRows([]);
                onSubmissionSuccess();
            } catch (error) {
                console.error('Error submitting sales record: ', error);
                alert('Failed to submit sales record.');
            }
        } else {
            setPinError('Incorrect PIN. Please try again.');
            setPin('');
        }
    };

    const handleCloseModal = () => {
        setIsPinModalOpen(false);
        setPin('');
        setPinError('');
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col items-center">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Create New Sales Record</h2>
                <p className="mt-1 text-md text-slate-600">Upload the daily sales Excel export and verify the line items.</p>
            </div>

            {successMessage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
                        <div className="mb-4 flex justify-center">
                            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-slate-800 mb-2">Success!</h3>
                        <p className="text-slate-600 mb-4">{successMessage}</p>
                        <button
                            onClick={() => setSuccessMessage('')}
                            className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
                <div className="max-w-5xl mx-auto">
                    <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
                        <h3 className="text-xl font-semibold text-slate-700 border-b pb-2">Sales Details</h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Timestamp</label>
                            <input
                                type="text"
                                value={now.toLocaleString()}
                                readOnly
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-slate-50 text-slate-600"
                            />
                        </div>

                        <div>
                            <label htmlFor="sales-upload" className="block text-sm font-medium text-gray-700 mb-1">Upload Sales Document (Excel)</label>
                            <input
                                id="sales-upload"
                                name="sales_upload"
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                            {fileName && (
                                <p className="mt-1 text-xs text-slate-500">Loaded file: {fileName}</p>
                            )}
                            {errorMessage && (
                                <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
                            )}
                        </div>

                        {columns.length > 0 && rows.length > 0 && (
                            <div>
                                <h4 className="text-lg font-semibold text-slate-700 mb-2">Sales Line Items</h4>
                                <div className="overflow-x-auto border rounded-lg">
                                    <table className="w-full min-w-[800px] text-sm text-left">
                                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                            <tr>
                                                {columns.map(column => (
                                                    <th key={column} className="p-3 whitespace-nowrap">{column}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row, rowIndex) => (
                                                <tr key={`sales-row-${rowIndex}`} className="border-t">
                                                    {columns.map(column => (
                                                        <td key={`${rowIndex}-${column}`} className="p-2">
                                                            <input
                                                                type="text"
                                                                value={row[column] || ''}
                                                                onChange={(e) => handleCellChange(rowIndex, column, e.target.value)}
                                                                className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-center pt-4">
                    <button
                        type="submit"
                        className="bg-red-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-red-700 transition text-lg disabled:bg-red-400"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Processing...' : 'Submit Details'}
                    </button>
                </div>
            </form>

            <Modal isOpen={isPinModalOpen} onClose={handleCloseModal} containerClassName="max-w-sm">
                <div className="p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Confirm Entry</h3>
                    <p className="text-sm text-slate-600 mb-4">Please enter your security PIN to log this entry.</p>
                    <div>
                        <label htmlFor="sales-pin-input" className="sr-only">Security PIN</label>
                        <input
                            id="sales-pin-input"
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handlePinConfirm()}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-center text-2xl tracking-[.5em]"
                            maxLength={4}
                            placeholder="****"
                            autoFocus
                        />
                    </div>
                    {pinError && <p className="text-red-500 text-sm mt-2 text-center">{pinError}</p>}
                    <div className="mt-6 flex justify-end space-x-2">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-md font-medium hover:bg-gray-300">Cancel</button>
                        <button type="button" onClick={handlePinConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700">Confirm</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
