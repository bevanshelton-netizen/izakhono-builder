'use client';

import { useState } from 'react';

type Props = {
  recordId: string;
  campaignId?: string | null;
};

export function DiscoveryEnquiryCta({ recordId, campaignId = null }: Props) {
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<string>('');

  async function submit() {
    if (!consent || state === 'submitting') return;
    setState('submitting');
    setResult('');
    try {
      const response = await fetch(`/api/connecta/v1/discovery/${encodeURIComponent(recordId)}/enquiries`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ message: message.trim(), consentToContact: true, campaignId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState('error');
        setResult(response.status === 401 ? 'Sign in to CONNECTA before sending an enquiry.' : (payload.error || 'We could not send the enquiry. Please try again.'));
        return;
      }
      setState('success');
      setResult(payload.enquiry?.attributionId ? `Enquiry received · reference ${payload.enquiry.attributionId}` : 'Enquiry received.');
      setMessage('');
    } catch {
      setState('error');
      setResult('CONNECTA is temporarily unavailable. Please try again.');
    }
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #1d3a31' }}>
      {state !== 'success' && (
        <>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What would you like to know?"
            rows={2}
            style={{ width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: 10, border: '1px solid #315c4e', background: '#06100d', color: '#f4fff9', outline: 'none', boxSizing: 'border-box' }}
          />
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, color: '#b8cfc5', fontSize: 11, lineHeight: 1.45 }}>
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            I consent to being contacted about this enquiry.
          </label>
          <button
            type="button"
            disabled={!consent || state === 'submitting'}
            onClick={submit}
            style={{ marginTop: 10, width: '100%', padding: '11px 14px', border: 0, borderRadius: 999, background: consent ? '#64dfad' : '#315c4e', color: '#06100d', fontWeight: 900, cursor: consent ? 'pointer' : 'not-allowed' }}
          >
            {state === 'submitting' ? 'Sending…' : 'Enquire'}
          </button>
        </>
      )}
      {result && <p role="status" style={{ color: state === 'success' ? '#7fe0b5' : '#f2c879', fontSize: 11, lineHeight: 1.5, margin: '10px 0 0' }}>{result}</p>}
      {state === 'success' && <p style={{ color: '#9eb8ad', fontSize: 11, lineHeight: 1.5, margin: '6px 0 0' }}>Enquiry is a lead event, not a sale. Any sale or outcome requires separate evidence.</p>}
    </div>
  );
}
