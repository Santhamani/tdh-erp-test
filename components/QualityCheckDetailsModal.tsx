import React, { useEffect } from 'react';
import type { LogEntry } from '../types';

interface QualityCheckDetailsModalProps {
  record: LogEntry;
  onClose: () => void;
}

const prettyLabel = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Id$/, ' ID');

const isIsoDateString = (s: string) =>
  typeof s === 'string' && (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s));

const isBase64DataUrl = (s: string) => typeof s === 'string' && s.startsWith('data:');

export const QualityCheckDetailsModal: React.FC<QualityCheckDetailsModalProps> = ({ record, onClose }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!record) return null;

  if (typeof record.details !== 'object' || record.details === null) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start sm:items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl p-4 shadow-xl max-w-[380px] w-full" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-xl font-bold text-red-600">Error</h2>
          <p className="mt-2 text-slate-600">The details for this quality record are invalid or corrupted.</p>
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700">Close</button>
          </div>
        </div>
      </div>
    );
  }

  const details = record.details as Record<string, any>;

  const getStatusBadge = (status: any) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'APPROVED':
        return <span className="text-green-600 font-extrabold">APPROVED</span>;
      case 'REJECTED':
        return <span className="text-red-600 font-extrabold">REJECTED</span>;
      default:
        return <span className="text-yellow-600 font-extrabold">PENDING</span>;
    }
  };

  const renderValue = (val: any) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-slate-400">N/A</span>;
    }

    if (typeof val === 'boolean') return <span>{val ? 'Yes' : 'No'}</span>;
    if (typeof val === 'number') return <span>{Number.isFinite(val) ? val : String(val)}</span>;

    if (typeof val === 'string') {
      if (isBase64DataUrl(val)) {
        if (val.startsWith('data:image/')) {
          return <img src={val} alt="attachment" className="max-h-40 w-auto mx-auto rounded-md border" />;
        }
        if (val.startsWith('data:application/pdf')) {
          return (
            <div className="space-y-2">
              <a href={val} target="_blank" rel="noopener noreferrer" className="text-sm underline text-blue-600">Open PDF</a>
              <iframe src={val} title="pdf-preview" className="w-full h-44 border rounded-md" />
            </div>
          );
        }
        return <a href={val} download="attachment" className="text-sm underline text-blue-600">Download attachment</a>;
      }

      if (isIsoDateString(val)) {
        try {
          const d = new Date(val);
          if (!isNaN(d.getTime())) return <span>{d.toLocaleString()}</span>;
        } catch {}
      }

      if (val.length > 200 || val.includes('\n')) {
        return <pre className="whitespace-pre-wrap text-sm text-slate-800 p-2 bg-white rounded-md border">{val}</pre>;
      }

      return <span className="text-slate-800">{val}</span>;
    }

    if (Array.isArray(val) || typeof val === 'object') {
      return <pre className="whitespace-pre-wrap text-sm text-slate-800 p-2 bg-white rounded-md border">{JSON.stringify(val, null, 2)}</pre>;
    }

    return <span>{String(val)}</span>;
  };

  const hiddenKeys = new Set(['stageId', 'userId']);
  const entries = Object.entries(details).filter(([k]) => !hiddenKeys.has(k));

  const orderedKeys = [
    'size_analysis_7',
    'size_analysis_5',
    'size_analysis_4',
    'small_mud_percent',
    'big_mud_stones_percent',
    'damage_1',
    'physical_damage_2',
    'moisture_content_percent',
  ];

  return (
    // outer wrapper: align to top on small screens to avoid keyboard overlap; center on larger
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-50 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[380px] sm:max-w-2xl mx-auto transform transition-transform duration-200 max-h-[85vh] flex flex-col overflow-hidden mt-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} // respect phone safe area
      >
        {/* Header */}
        <div className="p-5 border-b bg-white rounded-t-2xl sm:rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            {/* Title */}
            <h2 className="text-2xl font-bold text-slate-800 leading-tight flex-shrink">Quality Inspection</h2>
            
            {/* User/Ticket card */}
            <div className="bg-slate-200 px-4 py-3 rounded-xl shadow-md flex-shrink-0">
              <div className="text-sm whitespace-nowrap">
                User: <span className="font-semibold">{record.userName ?? record.userId}</span>
              </div>
              {details.transaction_id && (
                <p className="mt-1 text-sm whitespace-nowrap">
                  Ticket: <span className="font-semibold">{String(details.transaction_id)}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Body (scrollable). Reduced max-height so footer area remains visible */}
        <div className="p-3 sm:p-4 md:p-6 flex-1 min-h-0 overflow-y-auto space-y-4 pb-6">

          {/* Test Results & Details */}
          <div className="bg-white p-4 rounded-xl shadow-md">
            <h3 className="text-xl font-bold text-red-700 border-b-2 border-red-200 pb-2 mb-3">Test Results & Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {orderedKeys.map((k) =>
                details[k] !== undefined ? (
                  <div key={k}>
                    <p className="text-xs text-slate-500">{prettyLabel(k)}</p>
                    <div className="mt-1">{renderValue(details[k])}</div>
                  </div>
                ) : null
              )}

              {entries.map(([key, value]) => {
                if (orderedKeys.includes(key) || ['vehicle_number', 'transaction_id', 'note', 'sample_id', 'upload_report'].includes(key)) return null;
                return (
                  <div key={key}>
                    <p className="text-xs text-slate-500">{prettyLabel(key)}</p>
                    <div className="mt-1">{renderValue(value)}</div>
                  </div>
                );
              })}
            </div>
          </div>
              {/* Recorded: full-width card, will wrap (no horizontal overflow) */}
              <div className="w-full">
                <p className="text-base text-slate-700 bg-white p-4 rounded-xl shadow-md break-words">
                  Recorded: {new Date(record.timestamp).toLocaleString('en-US', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
          {/* Remarks */}
          {details.remarks && (
            <div className="bg-white p-3 rounded-xl shadow-md">
              <h3 className="text-sm font-semibold text-red-700 mb-2">Inspector Remarks</h3>
              <pre className="whitespace-pre-wrap text-sm text-slate-800 p-2 bg-white rounded-md border">{String(details.remarks)}</pre>
            </div>
          )}

          {/* Upload preview */}
          {details.upload_report && (
            <div className="bg-white p-3 rounded-xl shadow-md">
              <h3 className="text-xl font-bold text-red-700 border-b-2 border-red-200 pb-2 mb-3">Uploaded Report</h3>
              <div>
                {isBase64DataUrl(details.upload_report) ? (
                  details.upload_report.startsWith('data:image/') ? (
                    <img src={details.upload_report} alt="report" className="w-full rounded-md border" />
                  ) : details.upload_report.startsWith('data:application/pdf') ? (
                    <iframe src={details.upload_report} title="report-pdf" className="w-full h-60 sm:h-80 border rounded-md" />
                  ) : (
                    <a href={details.upload_report} target="_blank" rel="noopener noreferrer" className="text-sm underline text-blue-600">Open attachment</a>
                  )
                ) : (
                  <a href={String(details.upload_report)} target="_blank" rel="noopener noreferrer" className="text-sm underline text-blue-600">Open attachment</a>
                )}
              </div>
            </div>
          )}
        <div className="bg-white p-4 rounded-xl shadow-md">
            <h3 className="text-xl font-bold text-red-700 border-b-2 border-red-200 pb-2 mb-3">Additional Notes</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-semibold text-slate-800">{details.note ?? 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - sticky so always visible */}
        <div
          className="bg-slate-100 p-3 sm:p-4 border-t flex justify-end gap-3 sticky bottom-0 z-30 rounded-b-2xl"
          style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 8px)` }} // ensure safe area + spacing
        >
          <button onClick={onClose} className="bg-slate-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-slate-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default QualityCheckDetailsModal;