import React, { useEffect, useRef, useState } from 'react';
import { PROCESS_STAGES } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { FormFieldComponent } from './FormField';
import { db } from '../firebase/firebase';
import { collection, query, onSnapshot, where, getDocs } from 'firebase/firestore';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

type SubmissionProps = {
  onSubmissionSuccess: () => void;
};

export const QualityCheckForm: React.FC<SubmissionProps> = ({ onSubmissionSuccess }) => {
  const { currentUser, verifyPin, submitStageData, getInModeVehicles } = useAuth() as any;
  const formRef = useRef<HTMLFormElement>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [submittedData, setSubmittedData] = useState<Record<string, any> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [vehicleInput, setVehicleInput] = useState('');
  const [vehicleExists, setVehicleExists] = useState<boolean | null>(null);
  const [isCheckingVehicle, setIsCheckingVehicle] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<Record<string, any> | null>(null);

  // Vehicles dropdown
  const [inVehicles, setInVehicles] = useState<string[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [showVehicleSuggestions, setShowVehicleSuggestions] = useState(false);
  const filteredVehicles = inVehicles.filter(v =>
      v.toLowerCase().includes(vehicleInput.toLowerCase())
    );
  // Stage & fields
  const qualityStage = PROCESS_STAGES.find(stage => stage.id === 'quality-check');
  if (!qualityStage) {
    return <p className="text-center text-red-500">Error: Quality Check stage configuration could not be found. Please contact an administrator.</p>;
  }
  const qualityFields = qualityStage.formFields;
  useEffect(() => {
          const handler = () => setShowVehicleSuggestions(false);
          document.addEventListener('click', handler);
          return () => document.removeEventListener('click', handler);
      }, []);
  // Load IN-mode vehicles (prefer auth helper, fallback to Firestore subscription)
  useEffect(() => {
    let mounted = true;
    setVehiclesLoading(true);

    // Only attempt to load vehicles if user is authenticated
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
      const used = await loadFromAuthHelper();
      if (used) return;

      // Fallback: subscribe to arrival_records and collect vehicle_numbers with gate_mode === 'in' (excluding deleted)
      try {
        const q = query(collection(db, 'arrival_records'));
        const unsub = onSnapshot(q, snapshot => {
          if (!mounted) return;
          const list: string[] = [];
          snapshot.docs.forEach(doc => {
            const d = doc.data();
            const details = (d && (d.details || d)) as Record<string, any>;
            const gateMode = String(details?.gate_mode ?? '').toLowerCase();
            const vehicleNum = details?.vehicle_number;
            const isDeleted = d?.deleted === true;
            if (vehicleNum && typeof vehicleNum === 'string' && gateMode === 'in' && !isDeleted) {
              list.push(vehicleNum.trim());
            }
          });
          const unique = Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
          setInVehicles(unique);
          setVehiclesLoading(false);
        }, err => {
          // Only log error if user is still authenticated (ignore logout errors)
          if (currentUser && mounted) {
            console.error('Error listening arrival_records:', err);
          }
          if (mounted) {
            setInVehicles([]);
            setVehiclesLoading(false);
          }
        });

        return unsub;
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

  const checkVehicleExists = async (vehicleNumber: string) => {
    if (!vehicleNumber.trim()) {
      setVehicleExists(null);
      return;
    }

    setIsCheckingVehicle(true);
    try {
      const q = query(
        collection(db, 'quality-check_records'),
        where('details.vehicle_number', '==', vehicleNumber.trim().toUpperCase())
      );

      const snapshot = await getDocs(q);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todaysRecords = snapshot.docs.filter(doc => {
        const data = doc.data();
        if (data?.deleted === true) return false;
        
        const timestamp = data.timestamp?.toDate(); // Convert Firestore Timestamp to JS Date
        return timestamp && timestamp >= today && timestamp < tomorrow;
      });

      setVehicleExists(todaysRecords.length > 0);
    } catch (error) {
      console.error("Error checking vehicle existence:", error);
      setVehicleExists(null); // Set to null on error
    } finally {
      setIsCheckingVehicle(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      checkVehicleExists(vehicleInput);
    }, 500); // 500ms debounce

    return () => clearTimeout(debounceTimer);
  }, [vehicleInput]);

  // Helper: sanitize integer-only on typing (used in input onChange)
  const handleIntegerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // keep digits only (no decimals)
    const digits = (e.target.value || '').replace(/\D+/g, '');
    e.target.value = digits;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data: Record<string, any> = Object.fromEntries(formData.entries());

      // file handling
      const reportFile = formData.get('upload_report') as File;
      if (reportFile && reportFile.size > 0) {
        try {
          data.upload_report = await fileToBase64(reportFile);
        } catch (err) {
          console.error('Error converting file:', err);
          alert('There was an error processing the report file.');
          setIsSubmitting(false);
          return;
        }
      } else {
        data.upload_report = '';
      }

      // Defensive numeric sanitization:
      // - find numeric fields from qualityFields (type==='number')
      // - except moisture field names ('moisture', 'moisture_content') we coerce to integer
      const moistureNames = new Set(['moisture', 'moisture_content']);
      qualityFields.forEach((f:any) => {
        if (f.type === 'number') {
          const raw = data[f.name];
          if (raw === undefined || raw === null || raw === '') return;

          const parsed = Number.parseFloat(raw);
          data[f.name] = Number.isFinite(parsed)
            ? Number(parsed.toFixed(2))
            : 0;
        }
      });

      // Check for duplicate entry
      const vehicleNumber = data.vehicle_number;
      if (vehicleNumber) {
        try {
          const qualityCheckQuery = query(
            collection(db, 'quality-check_records'),
            where('details.vehicle_number', '==', vehicleNumber.toUpperCase())
          );
          const snapshot = await getDocs(qualityCheckQuery);
          
          // Filter out deleted records
          const activeRecords = snapshot.docs.filter(doc => {
            const docData = doc.data();
            return docData?.deleted !== true;
          });
          
          if (activeRecords.length > 0) {
            // Entry already exists, show confirmation modal
            setPendingSubmitData(data);
            setIsDuplicateModalOpen(true);
            setIsSubmitting(false);
            return;
          }
        } catch (err) {
          console.warn('Error checking for duplicates:', err);
          // Continue anyway if there's an error checking
        }
      }

      setSubmittedData(data);
      setIsSubmitting(false);
      setIsPinModalOpen(true);
    } catch (err) {
      console.error('Submit error', err);
      alert('An unexpected error occurred while preparing the quality report.');
      setIsSubmitting(false);
    }
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

  const handlePinConfirm = async () => {
    if (!currentUser || !submittedData || !qualityStage) return;

    if (verifyPin(pin)) {
      try {
        await submitStageData(qualityStage.id, submittedData);
        setSuccessMessage('Quality check report submitted successfully!');
        setTimeout(() => setSuccessMessage(''), 5000);
        handleCloseModal();
        setSubmittedData(null);
        formRef.current?.reset();
      } catch (err) {
        console.error('Error submitting quality check: ', err);
        alert('Failed to submit quality check report. Check console for details.');
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

  // Helper to render each field — overrides vehicle_number dropdown and integer-only numeric inputs
  const renderField = (field: any) => {
    // Vehicle number dropdown override
    if (field.name === 'vehicle_number') {
      return (
        <div key={field.name} className="grid grid-cols-2 items-start gap-2">
          <label className="block text-sm font-medium text-gray-700 pt-2">
            {field.label}
          </label>

          <div>
            <div className="relative">
              <input
                type="text"
                name="vehicle_number"
                value={vehicleInput}
                onChange={(e) => {
                  setVehicleInput(e.target.value);
                  setShowVehicleSuggestions(true);
                }}
                onFocus={() => setShowVehicleSuggestions(true)}
                placeholder={vehiclesLoading ? 'Loading IN vehicles...' : 'Enter vehicle number'}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                autoComplete="off"
              />

              {/* Suggestions list */}
              {showVehicleSuggestions && filteredVehicles.length > 0 && (
                <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-md max-h-48 overflow-y-auto">
                  {filteredVehicles.map(v => (
                    <li
                      key={v}
                      onClick={() => {
                        setVehicleInput(v);
                        setShowVehicleSuggestions(false);
                        checkVehicleExists(v);
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-red-50"
                    >
                      {v}
                    </li>
                  ))}
                </ul>
              )}

              {/* No results */}
              {showVehicleSuggestions && vehicleInput && filteredVehicles.length === 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-md px-3 py-2 text-sm text-gray-500">
                  No matching vehicles
                </div>
              )}
            </div>
            
            {/* Status Indicator */}
            <div className="mt-1 pl-1 h-4">
              {isCheckingVehicle ? (
                <span className="text-sm text-gray-500">Checking...</span>
              ) : vehicleExists === true ? (
                <span className="text-sm font-semibold text-red-500">Vehicle details Already Exist</span>
              ) : vehicleExists === false ? (
                <span className="text-sm font-semibold text-green-500">New Vehicle</span>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    // Numeric fields (enforce integer-only except moisture)
    if (field.type === 'number') {
        const isMoisture =
          field.name.toLowerCase() === 'moisture' ||
          field.name.toLowerCase() === 'moisture_content';
    
        return (
          <div key={field.name} className="grid grid-cols-2 items-center gap-2">
            <label className="block text-sm font-medium text-gray-700">{field.label}</label>
            <input
              name={field.name}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              onChange={(e) => {
                // Allow only numbers with up to 2 decimal places
                const value = e.target.value;
                if (!/^\d*(\.\d{0,2})?$/.test(value)) {
                  e.target.value = value.slice(0, -1);
                }
              }}
              onWheel={(e) => (e.target as HTMLElement).blur()}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder={field.placeholder || ''}
            />
          </div>
        );
      }

    // Default fallthrough to your FormFieldComponent (horizontal layout)
    return (
      <FormFieldComponent
        key={field.name}
        field={field}
        layout="horizontal"
        isRequired={false}
      />
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Create New Quality Check Record</h2>
        <p className="mt-1 text-md text-slate-600">Enter the vehicle number and the quality analysis details.</p>
      </div>

      {/* Success Flash Message */}
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
        <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md space-y-4">
          <h3 className="text-xl font-semibold text-slate-700 border-b pb-2">{qualityFields[0].label}</h3>

          {qualityFields.slice(1).map(renderField)}
        </div>

        <div className="flex justify-center pt-4">
          <button type="submit" className="bg-red-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-red-700 transition text-lg disabled:bg-red-400" disabled={isSubmitting}>
            {isSubmitting ? 'Processing...' : 'Submit Quality Report'}
          </button>
        </div>
      </form>

      {/* Duplicate Entry Confirmation Modal */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={handleCancelDuplicate}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-fade-in p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 mx-auto mb-4">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0-11a9 9 0 110 18 9 9 0 010-18z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2 text-center">Duplicate Entry</h3>
            <p className="text-sm text-slate-600 mb-6 text-center">An entry for this vehicle number already exists in quality check. Do you still want to enter quality check for this vehicle?</p>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={handleCancelDuplicate} className="px-4 py-2 bg-gray-200 rounded-md font-medium hover:bg-gray-300">Cancel</button>
              <button type="button" onClick={handleConfirmDuplicate} className="px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700">Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Confirmation Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={handleCloseModal}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-fade-in p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Confirm Entry</h3>
            <p className="text-sm text-slate-600 mb-4">Please enter your security PIN to log this entry.</p>
            <div>
              <label htmlFor="pin-input" className="sr-only">Security PIN</label>
              <input
                id="pin-input"
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
        </div>
      )}
    </div>
  );
};