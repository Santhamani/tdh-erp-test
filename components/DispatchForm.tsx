import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PROCESS_STAGES } from '../constants';
import { FormFieldComponent } from './FormField';
import { PlusIcon, TrashIcon } from './Icons';
import { db } from '../firebase/firebase';
import { collection, query, onSnapshot, where, getDocs } from 'firebase/firestore';
import { productData, Product } from '../productData';

interface DispatchFormProps {
  onSubmissionSuccess: () => void;
}

interface ItemRow {
  id: number;
  name: string;
  type: string;
  quantity: string;
  weight: string;
}

export const DispatchForm: React.FC<DispatchFormProps> = ({ onSubmissionSuccess }) => {
  const { currentUser, submitStageData, getInModeVehicles } = useAuth() as any;

  const stageConfig = PROCESS_STAGES.find(stage => stage.id === 'dispatch') as any;
  if (!stageConfig) {
    return <div className="text-red-500">Error: Dispatch stage configuration not found.</div>;
  }

  // Build initial form data (non-item fields)
  const initialFormData = stageConfig.formFields.reduce((acc: Record<string, any>, field: any) => {
    if (field.type !== 'heading' && !field.name.startsWith('item')) acc[field.name] = '';
    return acc;
  }, {});

  const [formData, setFormData] = useState<Record<string, any>>(initialFormData);
  const [items, setItems] = useState<ItemRow[]>([{ id: Date.now(), name: '', type: '', quantity: '', weight: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [driverNameManuallyEdited, setDriverNameManuallyEdited] = useState(false);
  const [vehicleInput, setVehicleInput] = useState('');
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<Record<string, any> | null>(null);
        // vehicle list for dropdown
    const [inVehicles, setInVehicles] = useState<string[]>([]);
    const [vehiclesLoading, setVehiclesLoading] = useState(true);
    const [showVehicleSuggestions, setShowVehicleSuggestions] = useState(false);
    const filteredVehicles = inVehicles.filter(v =>
        v.toLowerCase().includes(vehicleInput.toLowerCase())
    );
  const [vehicleDriverMap, setVehicleDriverMap] = useState<Map<string, string>>(new Map());
    useEffect(() => {
        const handler = () => setShowVehicleSuggestions(false);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);
  useEffect(() => {
    let mounted = true;
    setVehiclesLoading(true);

    // Only attempt to load vehicles if user is authenticated
    if (!currentUser) {
      setInVehicles([]);
      setVehiclesLoading(false);
      return;
    }

    const loadFromAuth = async () => {
      try {
        if (typeof getInModeVehicles === 'function') {
          const list = await getInModeVehicles();
          if (!mounted) return true;
          setInVehicles(Array.isArray(list) ? Array.from(new Set(list)).sort() : []);
          setVehiclesLoading(false);
          return true;
        }
      } catch (e) {
        console.warn('getInModeVehicles failed:', e);
      }
      return false;
    };

    const start = async () => {
      const used = await loadFromAuth();
      if (used) return;

      // Don't start listener if user is not authenticated
      if (!currentUser) {
        if (mounted) { setInVehicles([]); setVehiclesLoading(false); }
        return;
      }

      try {
        const q = query(collection(db, 'arrival_records'));
        const unsub = onSnapshot(q, snapshot => {
          if (!mounted) return;
          const list: string[] = [];
          const driverMap = new Map<string, string>();
          snapshot.docs.forEach(doc => {
            const d = doc.data();
            const details = (d && (d.details || d)) as Record<string, any>;
            const gateMode = String(details?.gate_mode ?? '').toLowerCase();
            const vehicleNum = details?.vehicle_number;
            const driverName = details?.driver_name || '';
            const isDeleted = d?.deleted === true;
            if (vehicleNum && typeof vehicleNum === 'string' && gateMode === 'in' && !isDeleted) {
              list.push(vehicleNum.trim());
              if (driverName) driverMap.set(vehicleNum.trim(), driverName);
            }
          });
          setInVehicles(Array.from(new Set(list)).sort((a, b) => a.localeCompare(b)));
          setVehicleDriverMap(driverMap);
          setVehiclesLoading(false);
        }, err => {
          // Only log error if user is still authenticated (ignore logout errors)
          if (currentUser && mounted) {
            console.error('arrival_records listen error', err);
          }
          if (mounted) { setInVehicles([]); setVehiclesLoading(false); }
        });
        return unsub;
      } catch (err) {
        console.warn('arrival_records fallback failed', err);
        if (mounted) { setInVehicles([]); setVehiclesLoading(false); }
      }
    };

    let unsubFn: (() => void) | undefined;
    (async () => {
      const maybe = await start();
      if (typeof maybe === 'function') unsubFn = maybe;
    })();

    return () => {
      mounted = false;
      if (unsubFn) unsubFn();
    };
  }, [currentUser, getInModeVehicles]);

  // Auto-populate driver name when vehicle is selected (only if not manually edited)
  useEffect(() => {
    if (formData.vehicle_number && !driverNameManuallyEdited) {
      const driverName = vehicleDriverMap.get(formData.vehicle_number) || '';
      setFormData(prev => ({ ...prev, driver_name: driverName }));
    }
  }, [formData.vehicle_number, vehicleDriverMap, driverNameManuallyEdited]);

  // helpers
  const setField = (name: string, value: any) => setFormData(prev => ({ ...prev, [name]: value }));

  const handleItemChange = (id: number, field: keyof ItemRow, value: string) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === id) {
          const newItem = { ...it, [field]: value };
          if (field === 'name') {
            const product = productData.find((p:any) => p.name === value);
            if (product) {
              const availableWeights = Object.keys(product.weights);
              newItem.weight = availableWeights.length > 0 ? availableWeights[0] : '';
            } else {
              newItem.weight = '';
            }
          }
          return newItem;
        }
        return it;
      })
    );
  };

  const addItem = () => setItems(prev => [...prev, { id: Date.now(), name: '', type: '', quantity: '', weight: '' }]);
  const removeItem = (id: number) => setItems(prev => prev.length > 1 ? prev.filter(it => it.id !== id) : prev);

  const sanitizeName = (s: string) => s.replace(/[^A-Za-z0-9\s.\-']/g, '').replace(/\s{2,}/g, ' ').trim();
  const sanitizeInteger = (s: string) => (s || '').toString().replace(/\D+/g, '');
  const sanitizeDecimal = (s: string) => {
    const num = parseFloat(s) || 0;
    return num.toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // All fields are optional
      const vehicle = String(formData.vehicle_number || '').trim() || 'N/A';
      const destination = sanitizeName(String(formData.destination || '')) || 'N/A';
      const client = sanitizeName(String(formData.client_name || '')) || 'N/A';
      const bags = sanitizeInteger(String(formData.no_of_bags || '')) || 'N/A';

      // Sanitize numeric fields, show N/A if empty
      let gross = String(formData.gross_weight ?? formData.in_weight ?? '');
      let tare = String(formData.tare_weight ?? formData.out_weight ?? '');

      gross = gross.trim() ? sanitizeDecimal(gross) : 'N/A';
      tare = tare.trim() ? sanitizeDecimal(tare) : 'N/A';

      // items: map to item_1_name / item_1_quantity ... store strings
      const validItems = items
        .map(it => ({ 
          name: String(it.name || '').trim(), 
          quantity: sanitizeInteger(it.quantity || ''), 
          type: String(it.type || '').trim(),
          weight: sanitizeInteger(it.weight || '')
        }))
        .filter(it => it.name && it.quantity && it.weight);

      // Build details map exactly like your DB sample
      const details: Record<string, any> = {
        client_name: client,
        destination: destination,
        driver_name: String(formData.driver_name || '').trim() || 'N/A',
        gross_weight: gross, // string or N/A
        tare_weight: tare,   // string or N/A
        no_of_bags: bags,
        note: String(formData.note ?? '').trim() || 'N/A',
        vehicle_number: vehicle,
        // other fields will be filled below (item_N_name / item_N_quantity)
      };

      // Add items in sequential item_1_name, item_1_quantity ... order
      validItems.forEach((it, idx) => {
        const i = idx + 1;
        details[`item_${i}_name`] = it.name || 'N/A';
        details[`item_${i}_quantity`] = it.quantity || 'N/A';
        details[`item_${i}_weight`] = it.weight || 'N/A';
        const total = (parseFloat(it.quantity) || 0) * (parseFloat(it.weight) || 0);
        details[`item_${i}_total`] = total.toFixed(2);
        // optionally include type as item_N_type
        if (it.type) details[`item_${i}_type`] = it.type || 'N/A';
      });

      // Check for duplicate entry
      if (vehicle && vehicle !== 'N/A') {
        try {
          const dispatchQuery = query(
            collection(db, 'dispatch_records'),
            where('details.vehicle_number', '==', vehicle.toUpperCase())
          );
          const snapshot = await getDocs(dispatchQuery);
          
          const activeRecords = snapshot.docs.filter(doc => doc.data()?.deleted !== true);
          
          if (activeRecords.length > 0) {
            setPendingSubmitData(details);
            setIsDuplicateModalOpen(true);
            setIsSubmitting(false);
            return;
          }
        } catch (err) {
          console.warn('Error checking for duplicates:', err);
        }
      }

      // Submit via submitStageData (AuthContext will wrap into collection doc with timestamp/user)
      await submitStageData('dispatch', details);

      setSuccess('Dispatch record submitted successfully!');
      setFormData(initialFormData);
      setItems([{ id: Date.now(), name: '', type: '', quantity: '', weight: '' }]);
      setDriverNameManuallyEdited(false);
      
      // Auto-clear success message after 5 seconds (no redirect)
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDuplicate = async () => {
    if (pendingSubmitData) {
      try {
        await submitStageData('dispatch', pendingSubmitData);
        setSuccess('Dispatch record submitted successfully!');
        setFormData(initialFormData);
        setItems([{ id: Date.now(), name: '', type: '', quantity: '', weight: '' }]);
        setDriverNameManuallyEdited(false);
        setPendingSubmitData(null);
        setIsDuplicateModalOpen(false);
        
        setTimeout(() => {
          setSuccess(null);
        }, 5000);
      } catch (err: any) {
        setError(err?.message || 'Unexpected error');
        setIsSubmitting(false);
      }
    }
  };

  const handleCancelDuplicate = () => {
    setPendingSubmitData(null);
    setIsDuplicateModalOpen(false);
    setIsSubmitting(false);
  };

  // compute net weight as decimal difference, show Quintal as earlier if desired
  const grossDecimal = parseFloat(sanitizeDecimal(String(formData.gross_weight ?? formData.in_weight ?? '0'))) || 0;
  const tareDecimal = parseFloat(sanitizeDecimal(String(formData.tare_weight ?? formData.out_weight ?? '0'))) || 0;
  const netDecimal = Math.abs(grossDecimal - tareDecimal);

  const totalItemWeight = items.reduce((sum, item) => {
    const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.weight) || 0);
    return sum + total;
  }, 0);

  // render fields - vehicle_number rendered as dropdown
  const mainFields = stageConfig.formFields.filter((f:any) => !f.name.startsWith('item'));
  
  // Split fields into sections: before weight_heading and from weight_heading onwards
  const weightHeadingIndex = mainFields.findIndex((f:any) => f.name === 'weight_heading');
  const fieldsBeforeWeight = weightHeadingIndex >= 0 ? mainFields.slice(0, weightHeadingIndex) : mainFields;
  const fieldsFromWeight = weightHeadingIndex >= 0 ? mainFields.slice(weightHeadingIndex) : [];

  const getInputProps = (name: string) => {
    if (name === 'destination' || name === 'client_name') {
      return { onChange: (e: React.ChangeEvent<HTMLInputElement>) => setField(name, sanitizeName(e.target.value)) };
    }
    if (['gross_weight', 'tare_weight', 'in_weight', 'out_weight'].includes(name)) {
      return { inputMode: 'decimal' as const, step: '0.01' as const, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setField(name, e.target.value.replace(/[^\d.]/g, '').replace(/\.(?=.*\.)/g, '')) };
    }
    if (['no_of_bags'].includes(name)) {
      return { inputMode: 'numeric' as const, step: '1' as const, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setField(name, sanitizeInteger(e.target.value)) };
    }
    return {};
  };

  const renderField = (field: any) => {
    if (field.type === 'heading') {
      return (
        <div key={field.name} className="border-t pt-4 mt-6">
          <h3 className="text-lg font-semibold text-gray-700">{field.label}</h3>
        </div>
      );
    }

    if (field.name === 'vehicle_number') {
      return (
        <React.Fragment key="vehicle_number_group">
          {/* Vehicle Number */}
          <div className="mb-4 relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
            </label>

            <div className="relative flex">
              {/* Input */}
              <input
                type="text"
                name="vehicle_number"
                value={vehicleInput}
                onChange={(e) => {
                  setVehicleInput(e.target.value);
                  setField('vehicle_number', e.target.value);
                  setShowVehicleSuggestions(true);
                }}
                onFocus={() => setShowVehicleSuggestions(true)}
                placeholder={vehiclesLoading ? 'Loading IN vehicles...' : 'Enter vehicle number'}
                className="w-full px-3 py-2 border rounded-l-md focus:outline-none focus:ring-1 focus:ring-red-500"
                autoComplete="off"
              />

              {/* Suggestions */}
              {showVehicleSuggestions && filteredVehicles.length > 0 && (
                <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-md max-h-48 overflow-y-auto">
                  {filteredVehicles.map(v => (
                    <li
                      key={v}
                      onClick={() => {
                        setVehicleInput(v);
                        setField('vehicle_number', v);
                        setShowVehicleSuggestions(false);
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-red-50"
                    >
                      {v}
                    </li>
                  ))}
                </ul>
              )}

              {/* No match */}
              {showVehicleSuggestions && vehicleInput && filteredVehicles.length === 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-md px-3 py-2 text-sm text-gray-500">
                  No matching vehicles
                </div>
              )}
            </div>
          </div>

          {/* Driver Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Driver Name
            </label>
            <input
              type="text"
              name="driver_name"
              value={formData.driver_name || ''}
              onChange={(e) => {
                setField('driver_name', e.target.value);
                setDriverNameManuallyEdited(true);
              }}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="Auto-filled or enter manually"
            />
          </div>
        </React.Fragment>
      );
    }


    // show In Weight / Out Weight labels but keep underlying DB keys gross_weight/tare_weight
    if (field.name === 'gross_weight' || field.name === 'in_weight') {
      const name = field.name === 'in_weight' ? 'gross_weight' : field.name; // if config uses in_weight, map to gross_weight for DB
      return (
        <FormFieldComponent
          key={name}
          field={{ ...field, name: name, label: 'In Weight' }}
          value={String(formData[name] ?? '')}
          onChange={(n, v) => setField(n, v)}
          inputProps={getInputProps(name)}
          isRequired={false}
        />
      );
    }

    if (field.name === 'tare_weight' || field.name === 'out_weight') {
      const name = field.name === 'out_weight' ? 'tare_weight' : field.name;
      return (
        <FormFieldComponent
          key={name}
          field={{ ...field, name: name, label: 'Out Weight' }}
          value={String(formData[name] ?? '')}
          onChange={(n, v) => setField(n, v)}
          inputProps={getInputProps(name)}
          isRequired={false}
        />
      );
    }

    return (
      <FormFieldComponent
        key={field.name}
        field={field}
        value={String(formData[field.name] ?? '')}
        onChange={(n, v) => setField(n, v)}
        inputProps={getInputProps(field.name)}
        isRequired={false}
      />
    );
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg w-full max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Create Dispatch Record</h2>

      {/* Success Modal */}
      {success && (
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
            <p className="text-slate-600 mb-4">{success}</p>
            <button
              onClick={() => {
                setSuccess(null);
              }}
              className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dispatch Details section */}
        {fieldsBeforeWeight.map(renderField)}

        {/* Item Details */}
        <div key="item_section">
          <div className='flex justify-between items-center mb-4'>
            <h3 className="text-lg font-semibold text-gray-700">{stageConfig.formFields.find((f:any) => f.name === 'item_list_heading')?.label || 'Item Details'}</h3>
            <button type="button" onClick={addItem} className="flex items-center px-3 py-1.5 bg-red-600 text-white text-sm font-bold rounded-md hover:bg-red-700">
              <PlusIcon />
              <span className="ml-1">Add Item</span>
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => {
              const selectedProduct = productData.find((p:any) => p.name === item.name);
              const quantityOptions = [25, 30, 40, 50];
              const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.weight) || 0);

              return (
                <div key={item.id} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-gray-700">Item #{index + 1}</h4>
                    <button type="button" onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 disabled:opacity-50" disabled={items.length <= 1}>
                      <TrashIcon />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* Item Name */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                      <select
                        value={item.name}
                        onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="">Select Item</option>
                        {productData.map((p:any) => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bags</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                        placeholder="e.g., 10"
                      />
                    </div>

                    {/* Weight */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Weight (KG)</label>
                      <select
                        value={item.weight}
                        onChange={(e) => handleItemChange(item.id, 'weight', e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="">Weight</option>
                        {quantityOptions.map(q => (
                          <option key={q} value={q}>{q}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Total */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
                      <input
                        type="text"
                        value={total.toFixed(2)}
                        readOnly
                        disabled
                        className="w-full px-3 py-2 border rounded-md bg-gray-100"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weight Details section */}
        {fieldsFromWeight.map(renderField)}

        {/* Net weight (computed) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-700">Calculated Item Weight</h3>
            <p className="text-2xl font-bold text-gray-800 mt-2">{totalItemWeight.toFixed(2)} KG</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-700">Calculated Net Weight</h3>
            <p className="text-2xl font-bold text-gray-800 mt-2">{netDecimal.toFixed(2)} Quintal</p>
          </div>
        </div>

        {error && <div className="text-red-500 font-medium mt-4">Error: {error}</div>}

        <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-md hover:bg-red-700 disabled:bg-red-400 transition-colors duration-300 mt-6">
          {isSubmitting ? 'Submitting...' : 'Submit Dispatch Record'}
        </button>
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
            <p className="text-sm text-slate-600 mb-6 text-center">An entry for this vehicle already exists in dispatch. Do you still want to enter dispatch for this vehicle?</p>
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

export default DispatchForm;