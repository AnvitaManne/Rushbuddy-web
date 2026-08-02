import React from 'react';
import type { FIRExport } from '@/domain/types';
import { AlertCircle, Copy, Check, Download, Printer } from 'lucide-react';

function fmt(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function FirPackagePanel({
  fir,
  copied,
  onCopy,
}: {
  fir: FIRExport;
  copied?: boolean;
  onCopy: () => void;
}) {
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(fir, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rushbuddy-support-${fir.job_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPackage = () => {
    window.print();
  };

  return (
    <div className="fir-package space-y-3 rounded-xl p-4" style={{ background: '#0D0303', border: '1px solid #3B1111' }}>
      <p className="text-[10px] text-amber-200/90 flex items-start gap-1.5">
        <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
        {fir.disclaimer
          ?? 'RushBuddy campus support package — not a legal FIR or police filing.'}
      </p>

      <div className="grid gap-3 text-[11px]" style={{ color: '#FCA5A5' }}>
        <section>
          <div className="text-[10px] mb-1" style={{ color: '#7F1D1D', fontFamily: 'JetBrains Mono, monospace' }}>
            JOB · {fir.job_id}
          </div>
          <p>Generated {fmt(fir.generated_at)}</p>
        </section>

        <section className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] mb-1" style={{ color: '#7F1D1D', fontFamily: 'JetBrains Mono, monospace' }}>SENDER</div>
            <p className="text-red-200 font-medium">{fir.sender_name}</p>
            <p>{fir.sender_hostel}</p>
            {fir.sender_email && <p>{fir.sender_email}</p>}
          </div>
          <div>
            <div className="text-[10px] mb-1" style={{ color: '#7F1D1D', fontFamily: 'JetBrains Mono, monospace' }}>RUNNER</div>
            <p className="text-red-200 font-medium">{fir.runner_name}</p>
            {fir.runner_hostel && <p>{fir.runner_hostel}</p>}
            {fir.runner_email && <p>{fir.runner_email}</p>}
            <p className="opacity-70" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fir.runner_id}</p>
          </div>
        </section>

        <section>
          <div className="text-[10px] mb-1" style={{ color: '#7F1D1D', fontFamily: 'JetBrains Mono, monospace' }}>ITEM / ROUTE</div>
          <p>{fir.item_description}</p>
          {fir.declared_value != null && <p>Declared value ₹{fir.declared_value}</p>}
          <p>Pickup: {fir.pickup_location}</p>
          <p>Drop: {fir.drop_location}</p>
          {fir.corridor_landmark && <p>Landmark: {fir.corridor_landmark}</p>}
          {fir.receiver_phone && <p>Receiver phone: {fir.receiver_phone}</p>}
          <p>Handoff code (sender evidence): {fir.confirmation_code || '—'}</p>
        </section>

        <section>
          <div className="text-[10px] mb-1" style={{ color: '#7F1D1D', fontFamily: 'JetBrains Mono, monospace' }}>DISPUTE</div>
          <p className="text-red-200 font-medium">{fir.dispute_type ?? 'Not specified'}</p>
          {fir.dispute_description && <p>{fir.dispute_description}</p>}
        </section>

        <section>
          <div className="text-[10px] mb-1" style={{ color: '#7F1D1D', fontFamily: 'JetBrains Mono, monospace' }}>TIMELINE</div>
          <ul className="space-y-0.5">
            <li>Created · {fmt(fir.timeline.created_at)}</li>
            <li>Matched · {fmt(fir.timeline.matched_at)}</li>
            <li>Pickup · {fmt(fir.timeline.pickup_confirmed_at)}</li>
            <li>Delivered · {fmt(fir.timeline.delivered_at)}</li>
            <li>Disputed · {fmt(fir.timeline.disputed_at)}</li>
          </ul>
        </section>

        {!!fir.events?.length && (
          <section>
            <div className="text-[10px] mb-1" style={{ color: '#7F1D1D', fontFamily: 'JetBrains Mono, monospace' }}>
              EVENT LOG ({fir.events.length})
            </div>
            <ul className="space-y-1 max-h-40 overflow-auto">
              {fir.events.map((e, i) => (
                <li key={`${e.at}-${e.type}-${i}`}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{e.type}</span>
                  {' · '}
                  {fmt(e.at)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(fir.pickup_photo_url || fir.dropoff_photo_url) && (
          <section>
            <div className="text-[10px] mb-2" style={{ color: '#7F1D1D', fontFamily: 'JetBrains Mono, monospace' }}>
              EVIDENCE PHOTOS
            </div>
            <div className="flex flex-wrap gap-2">
              {fir.pickup_photo_url && (
                <a href={fir.pickup_photo_url} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={fir.pickup_photo_url}
                    alt="Pickup evidence"
                    className="h-24 w-24 object-cover rounded-lg border"
                    style={{ borderColor: '#3B1111' }}
                  />
                  <span className="text-[10px] block mt-1">Pickup</span>
                </a>
              )}
              {fir.dropoff_photo_url && (
                <a href={fir.dropoff_photo_url} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={fir.dropoff_photo_url}
                    alt="Dropoff evidence"
                    className="h-24 w-24 object-cover rounded-lg border"
                    style={{ borderColor: '#3B1111' }}
                  />
                  <span className="text-[10px] block mt-1">Dropoff</span>
                </a>
              )}
            </div>
          </section>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1 print:hidden">
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white"
          style={{ background: '#3B1111', border: '1px solid #7F1D1D' }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy JSON'}
        </button>
        <button
          type="button"
          onClick={downloadJson}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white"
          style={{ background: '#3B1111', border: '1px solid #7F1D1D' }}
        >
          <Download size={12} />
          Download JSON
        </button>
        <button
          type="button"
          onClick={printPackage}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white"
          style={{ background: '#3B1111', border: '1px solid #7F1D1D' }}
        >
          <Printer size={12} />
          Print
        </button>
      </div>
    </div>
  );
}
