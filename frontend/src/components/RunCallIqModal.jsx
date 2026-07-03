import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { callIqAPI } from '../services/api';

// Runs a Call-IQ agent against a specific call activity OR a manual call
// recording (auto-transcribed via Whisper if needed). Pass either
// { leadId, activityId } for AI-dialer / logged calls, or { recordingId }
// for an uploaded call recording.
export default function RunCallIqModal({ leadId, activityId, recordingId, onClose }) {
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState('');
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    callIqAPI.getAll()
      .then(r => {
        const list = r.data.agents || [];
        setAgents(list);
        if (list.length > 0) setAgentId(list[0]._id);
      })
      .catch(() => setError('Could not load Call IQ agents.'))
      .finally(() => setLoadingAgents(false));
  }, []);

  const runIt = async () => {
    if (!agentId) return;
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const payload = recordingId ? { recordingId } : { leadId, activityId };
      const r = await callIqAPI.run(agentId, payload);
      setResult(r.data.audit);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to run Call IQ agent.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600" /> Run Call IQ
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loadingAgents ? (
          <p className="text-sm text-gray-400">Loading agents…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-gray-500">No Call IQ agents found. Create one first under Call IQ Agents.</p>
        ) : (
          <>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Agent</label>
            <select
              className="input-field w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4"
              value={agentId}
              onChange={e => { setAgentId(e.target.value); setResult(null); setError(''); }}
            >
              {agents.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>

            <button
              onClick={runIt}
              disabled={running}
              className="btn-primary w-full rounded-xl py-2.5 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {running ? <><Loader2 className="w-4 h-4 animate-spin" /> {recordingId ? 'Transcribing & analyzing…' : 'Running…'}</> : 'Run Audit'}
            </button>
          </>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5 mt-3">{error}</p>
        )}

        {result && (
          <div className="mt-4 bg-violet-50/60 border border-violet-100 rounded-xl p-3.5">
            <div className="text-[10px] font-bold text-violet-500 uppercase tracking-wide mb-2">
              Result · <span className={result.status === 'success' ? 'text-green-600' : 'text-red-600'}>{result.status}</span>
            </div>
            {result.status === 'failed' && result.error && (
              <p className="text-xs text-red-600 mb-2">{result.error}</p>
            )}
            <div className="space-y-1.5">
              {(agents.find(a => a._id === agentId)?.outputFields || []).map(fld => (
                <div key={fld.key} className="text-xs">
                  <span className="font-semibold text-gray-700">{fld.label || fld.key}: </span>
                  <span className="text-gray-600">
                    {result.result && result.result[fld.key] !== undefined && result.result[fld.key] !== null && result.result[fld.key] !== ''
                      ? (typeof result.result[fld.key] === 'object' ? JSON.stringify(result.result[fld.key]) : String(result.result[fld.key]))
                      : '—'}
                  </span>
                </div>
              ))}
              {(!agents.find(a => a._id === agentId)?.outputFields?.length) && (
                <p className="text-xs text-gray-400">This agent has no output fields configured.</p>
              )}
            </div>
          </div>
        )}

        <button onClick={onClose} className="btn-secondary w-full rounded-xl py-2.5 font-semibold text-sm mt-4">Close</button>
      </div>
    </div>
  );
}