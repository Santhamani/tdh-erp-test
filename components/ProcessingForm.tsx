import React, { useEffect, useRef, useState } from 'react';
import { PROCESS_STAGES, PROCESSING_STAGE_COLUMNS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from './Modal';
import { db } from '../firebase/firebase';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';

type SubmissionProps = {
    onSubmissionSuccess: () => void;
};

export const ProcessingForm: React.FC<SubmissionProps> = ({ onSubmissionSuccess }) => {
    const { currentUser, verifyPin, submitStageData, getInModeVehicles } = useAuth() as any;
    const formRef = useRef<HTMLFormElement>(null);
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [submittedData, setSubmittedData] = useState<Record<string, any> | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [pendingSubmitData, setPendingSubmitData] = useState<Record<string, any> | null>(null);

    const [vehicleInput, setVehicleInput] = useState('');
    const [showVehicleSuggestions, setShowVehicleSuggestions] = useState(false);
    const [inVehicles, setInVehicles] = useState<string[]>([]);
    const [vehiclesLoading, setVehiclesLoading] = useState(true);
    const [tableValues, setTableValues] = useState<string[][]>(() => (
        Array.from({ length: 2 }, () => Array.from({ length: PROCESSING_STAGE_COLUMNS.length }, () => ''))
    ));

    const processingStage = PROCESS_STAGES.find(stage => stage.id === 'processing');
    if (!processingStage) return <p className="text-center text-red-500">Error: Processing stage configuration not found.</p>;

    const filteredVehicles = inVehicles.filter(v => v.toLowerCase().includes(vehicleInput.toLowerCase()));

    useEffect(() => {
        const handler = () => setShowVehicleSuggestions(false);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    useEffect(() => {
        let mounted = true;
        setVehiclesLoading(true);

        if (!currentUser) {
            setInVehicles([]);
            setVehiclesLoading(false);
            return;
        }

        const loadFromAuthHelper = async () => {
            try {
                if (typeof getInModeVehicles === 'function') {
                    const list = await getInModeVehicles();
                    if (!mounted) return true;
                    setInVehicles(Array.isArray(list) ? Array.from(new Set(list)).sort() : []);
                    setVehiclesLoading(false);
                    return true;
                }
            } catch (err) {
                console.warn('getInModeVehicles failed:', err);
            }
            return false;
        };

        const start = async () => {
            const usedHelper = await loadFromAuthHelper();
            if (usedHelper) return;

            try {
                const q = query(collection(db, 'arrival_records'));
                const unsub = onSnapshot(q, snapshot => {
                    if (!mounted) return;
                    const list: string[] = [];
                    snapshot.docs.forEach(doc => {
                        const data = doc.data();
                        const details = (data && (data.details || data)) as Record<string, any>;
                        const gateMode = String(details?.gate_mode ?? '').toLowerCase();
                        const vehicleNum = details?.vehicle_number;
                        const isDeleted = data?.deleted === true;
                        if (vehicleNum && typeof vehicleNum === 'string' && gateMode === 'in' && !isDeleted) {
                            list.push(vehicleNum.trim());
                        }
                    });
                    const unique = Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
                    setInVehicles(unique);
                    setVehiclesLoading(false);
                }, err => {
                    if (currentUser && mounted) {
                        console.error('Error listening arrival_records:', err);
                    }
                    if (mounted) {
                        setInVehicles([]);
                        setVehiclesLoading(false);
                    }
                });

                return () => unsub();
            } catch (err) {
                console.warn('Failed to query arrival_records fallback:', err);
                if (mounted) {
                    setInVehicles([]);
                    setVehiclesLoading(false);
                }
            }
        };

        let unsubFn: (() => void) | undefined;
        (async () => {
            const maybeUnsub = await start();
            if (typeof maybeUnsub === 'function') unsubFn = maybeUnsub;
        })();

        return () => {
            mounted = false;
            if (unsubFn) unsubFn();
        };
    }, [currentUser, getInModeVehicles]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData(e.currentTarget);
        const data: Record<string, any> = Object.fromEntries(formData.entries());

        if (data.vehicle_number) {
            data.vehicle_number = String(data.vehicle_number).toUpperCase();
        }

        const vehicleNumber = data.vehicle_number;
        if (vehicleNumber) {
            try {
                const processingQuery = query(
                    collection(db, 'processing_records'),
                    where('details.vehicle_number', '==', vehicleNumber)
                );
                const snapshot = await getDocs(processingQuery);

                const activeRecords = snapshot.docs.filter(doc => doc.data()?.deleted !== true);

                if (activeRecords.length > 0) {
                    setPendingSubmitData(data);
                    setIsDuplicateModalOpen(true);
                    setIsSubmitting(false);
                    return;
                }
            } catch (err) {
                console.warn('Error checking for duplicates:', err);
            }
        }

        setSubmittedData(data);
        setIsSubmitting(false);
        setIsPinModalOpen(true);
    };

    const handlePinConfirm = async () => {
        if (!currentUser || !submittedData) return;

        if (verifyPin(pin)) {
            try {
                await submitStageData(processingStage.id, submittedData);
                setSuccessMessage('Processing record submitted successfully!');
                setTimeout(() => setSuccessMessage(''), 5000);
                handleCloseModal();
                setSubmittedData(null);
                formRef.current?.reset();
                setVehicleInput('');
                onSubmissionSuccess();
            } catch (error) {
                console.error('Error submitting processing record: ', error);
                alert('Failed to submit processing record.');
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

    const handleConfirmDuplicate = () => {
        if (pendingSubmitData) {
            setSubmittedData(pendingSubmitData);
            setPendingSubmitData(null);
            setIsDuplicateModalOpen(false);
            setIsPinModalOpen(true);
        }
    };

    const handleCancelDuplicate = () => {
        setPendingSubmitData(null);
        setIsDuplicateModalOpen(false);
    };

    const handleVehicleSelect = (vehicle: string) => {
        setVehicleInput(vehicle);
        setShowVehicleSuggestions(false);
    };

    const sanitizeDecimalInput = (value: string) => {
        const cleaned = value.replace(/[^0-9.]/g, '');
        const [whole, decimals = ''] = cleaned.split('.');
        const safeWhole = whole.replace(/^0+(?=\d)/, '');
        const safeDecimals = decimals.slice(0, 2);
        if (cleaned.includes('.')) {
            return `${safeWhole || '0'}.${safeDecimals}`;
        }
        return safeWhole;
    };

    const formatDecimal = (value: string) => {
        if (!value) return '';
        const parsed = Number.parseFloat(value);
        if (!Number.isFinite(parsed)) return '';
        return parsed.toFixed(2);
    };

    const handleTableChange = (rowIndex: number, colIndex: number, rawValue: string) => {
        const sanitized = sanitizeDecimalInput(rawValue);
        setTableValues(prev => {
            const next = prev.map(row => row.slice());
            next[rowIndex][colIndex] = sanitized;
            if (rowIndex === 1 && colIndex < PROCESSING_STAGE_COLUMNS.length - 1) {
                next[0][colIndex + 1] = sanitized;
            }
            return next;
        });
    };

    const handleTableBlur = (rowIndex: number, colIndex: number) => {
        setTableValues(prev => {
            const next = prev.map(row => row.slice());
            next[rowIndex][colIndex] = formatDecimal(next[rowIndex][colIndex]);
            return next;
        });
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col items-center">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Create New Pre Processing Record</h2>
                <p className="mt-1 text-md text-slate-600">Enter the pre processing details to log a new entry.</p>
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
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
                        <h3 className="text-xl font-semibold text-slate-700 border-b pb-2">Pre Processing Details</h3>

                        <div>
                            <label htmlFor="vehicle_number" className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                            <div className="relative">
                                <input
                                    id="vehicle_number"
                                    name="vehicle_number"
                                    type="text"
                                    value={vehicleInput}
                                    onChange={(e) => {
                                        setVehicleInput(e.target.value);
                                        setShowVehicleSuggestions(true);
                                    }}
                                    onFocus={() => setShowVehicleSuggestions(true)}
                                    placeholder={vehiclesLoading ? 'Loading vehicles...' : 'Type or select vehicle'}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                    autoComplete="off"
                                />
                                {showVehicleSuggestions && !vehiclesLoading && filteredVehicles.length > 0 && (
                                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-md mt-1 max-h-52 overflow-y-auto">
                                        {filteredVehicles.map(vehicle => (
                                            <button
                                                key={vehicle}
                                                type="button"
                                                onClick={() => handleVehicleSelect(vehicle)}
                                                className="block w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                                            >
                                                {vehicle}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                            <select
                                id="brand"
                                name="brand"
                                defaultValue=""
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                <option value="" disabled>Select brand</option>
                                <option value="Double horse">Double horse</option>
                                <option value="Maharani">Maharani</option>
                                <option value="Chinna Goti">Chinna Goti</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="product_name" className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                            <input
                                id="product_name"
                                name="product_name"
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                placeholder="Enter product name"
                            />
                        </div>

                        <div>
                            <h4 className="text-lg font-semibold text-slate-700 mb-2">Stage Table</h4>
                            <div className="overflow-x-auto border rounded-lg">
                                <table className="w-full min-w-[720px] text-sm text-left">
                                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                        <tr>
                                            {PROCESSING_STAGE_COLUMNS.map(col => (
                                                <th key={col} className="p-3 whitespace-nowrap">{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[0, 1].map(rowIndex => (
                                            <tr key={`row-${rowIndex}`} className="border-t">
                                                {PROCESSING_STAGE_COLUMNS.map((col, colIndex) => (
                                                    <td key={`${rowIndex}-${colIndex}`} className="p-2">
                                                        <div className="flex items-center gap-2 min-w-[140px]">
                                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${rowIndex === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                                {rowIndex === 0 ? '+' : '-'}
                                                            </span>
                                                            <input
                                                                name={`stage_row_${rowIndex + 1}_col_${colIndex + 1}`}
                                                                type="number"
                                                                inputMode="decimal"
                                                                step="0.01"
                                                                value={tableValues[rowIndex][colIndex]}
                                                                onChange={(e) => handleTableChange(rowIndex, colIndex, e.target.value)}
                                                                onBlur={() => handleTableBlur(rowIndex, colIndex)}
                                                                className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                                                                placeholder="0.00"
                                                            />
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
                        <label htmlFor="processing-pin-input" className="sr-only">Security PIN</label>
                        <input
                            id="processing-pin-input"
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

            {isDuplicateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={handleCancelDuplicate}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-fade-in p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 mx-auto mb-4">
                            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0-11a9 9 0 110 18 9 9 0 010-18z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2 text-center">Duplicate Entry</h3>
                        <p className="text-sm text-slate-600 mb-6 text-center">An entry for this vehicle already exists in processing. Do you still want to enter processing for this vehicle?</p>
                        <div className="flex justify-end space-x-2">
                            <button type="button" onClick={handleCancelDuplicate} className="px-4 py-2 bg-gray-200 rounded-md font-medium hover:bg-gray-300">Cancel</button>
                            <button type="button" onClick={handleConfirmDuplicate} className="px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700">Continue</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
