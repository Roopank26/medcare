/**
 * Medcare — Admin Dashboard (Phase 8)
 *
 * Sections:
 * - System Analytics: total users, total predictions, feedback stats
 * - ML Stats: average confidence, low-confidence rate, top diseases
 * - Error Tracking: last 10 error log entries from ML /metrics
 * - API Metrics: uptime, request count, inference latency
 * - Feedback Dataset: downloadable chatFeedback records for retraining
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getChatFeedback }       from '../../firebase/firestore';
import { useAuth }               from '../../context/AuthContext';
import { mlMetrics, mlHealth }   from '../../services/mlApi';
import { subscribeToPatients }   from '../../firebase/firestore';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import useToast                  from '../../hooks/useToast';
import logger                    from '../../utils/logger';

const StatCard = ({ label, value, sub, color = 'bg-blue-50 text-blue-700' }) => (
  <div className='card flex flex-col gap-1'>
    <p className='text-xs text-gray-400 font-semibold uppercase tracking-wide'>{label}</p>
    <p className={`text-3xl font-display font-bold ${color.split(' ')[1]}`}>{value ?? '—'}</p>
    {sub && <p className='text-xs text-gray-400'>{sub}</p>}
  </div>
);

const SectionHeader = ({ icon, title, sub }) => (
  <div className='flex items-center gap-3 mb-4'>
    <div className='w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-lg'>{icon}</div>
    <div>
      <h3 className='font-display font-semibold text-gray-900'>{title}</h3>
      {sub && <p className='text-xs text-gray-400'>{sub}</p>}
    </div>
  </div>
);

const AdminDashboard = () => {
  const { user } = useAuth();
  const toast    = useToast();

  const [mlStats,    setMlStats]    = useState(null);
  const [mlHealthD,  setMlHealthD]  = useState(null);
  const [feedback,   setFeedback]   = useState([]);
  const [patients,   setPatients]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [logBuffer,  setLogBuffer]  = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // ML metrics + health
      const [metricsRes, healthRes] = await Promise.allSettled([
        mlMetrics(),
        mlHealth(),
      ]);
      if (metricsRes.status === 'fulfilled') setMlStats(metricsRes.value.data);
      if (healthRes.status  === 'fulfilled') setMlHealthD(healthRes.value.data);

      // Feedback records
      const { feedback: fb, error: fbErr } = await getChatFeedback();
      if (!fbErr) setFeedback(fb);

      // Client-side log buffer (last 20 entries)
      setLogBuffer(logger.getBuffer().slice(-20).reverse());
    } catch (err) {
      toast.error('Could not load admin metrics');
      logger.error('[AdminDashboard] Load failed', err);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!user?.uid) return;
    loadAll();
    const unsub = subscribeToPatients(user.uid, ({ patients: docs }) => setPatients(docs));
    return () => unsub();
  }, [user?.uid, loadAll]);

  // ── Derived stats ─────────────────────────────────────────
  const helpfulCount    = feedback.filter((f) => f.helpful).length;
  const unhelpfulCount  = feedback.filter((f) => !f.helpful).length;
  const totalFeedback   = feedback.length;
  const helpfulPct      = totalFeedback ? Math.round((helpfulCount / totalFeedback) * 100) : 0;

  const feedbackChartData = [
    { name: 'Helpful',     value: helpfulCount,   color: '#58D68D' },
    { name: 'Not helpful', value: unhelpfulCount, color: '#E74C3C' },
  ];

  // Download feedback as JSON for retraining
  const downloadFeedback = () => {
    const blob = new Blob([JSON.stringify(feedback, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `medcare_chat_feedback_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center py-20'>
        <div className='text-center'>
          <div className='w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3' />
          <p className='text-gray-400 text-sm'>Loading admin metrics…</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-8 animate-fade-in'>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='font-display font-bold text-2xl text-gray-900'>Admin Dashboard</h2>
          <p className='text-sm text-gray-400 mt-0.5'>System health, ML performance, and feedback analytics</p>
        </div>
        <button onClick={loadAll} className='btn-outline text-sm flex items-center gap-2'>
          🔄 Refresh
        </button>
      </div>

      {/* ── System Overview ────────────────────────────────── */}
      <section>
        <SectionHeader icon='📊' title='System Overview' sub='Real-time platform metrics' />
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <StatCard label='Total Patients'   value={patients.length}                      color='bg-blue-50 text-blue-700' />
          <StatCard label='ML Predictions'   value={mlStats?.predictions_total ?? '—'}    color='bg-green-50 text-green-700' />
          <StatCard label='ML Uptime'        value={mlStats ? `${Math.round(mlStats.uptime_seconds / 60)}m` : '—'} color='bg-purple-50 text-purple-700' />
          <StatCard label='Total API Calls'  value={mlStats?.requests_total ?? '—'}       color='bg-amber-50 text-amber-700' />
        </div>
      </section>

      {/* ── ML Service Health ──────────────────────────────── */}
      <section>
        <SectionHeader icon='🤖' title='ML Service' sub='Flask inference engine status' />
        <div className='card'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-6'>
            <div>
              <p className='text-xs text-gray-400 mb-1'>Status</p>
              <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-full ${
                mlHealthD?.model_ready ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${mlHealthD?.model_ready ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                {mlHealthD?.model_ready ? 'Ready' : 'Offline'}
              </span>
            </div>
            <div>
              <p className='text-xs text-gray-400 mb-1'>Version</p>
              <p className='text-sm font-semibold text-gray-700'>{mlHealthD?.version ?? '—'}</p>
            </div>
            <div>
              <p className='text-xs text-gray-400 mb-1'>Diseases</p>
              <p className='text-sm font-semibold text-gray-700'>{mlHealthD?.diseases ?? '—'}</p>
            </div>
            <div>
              <p className='text-xs text-gray-400 mb-1'>Chatbot Mode</p>
              <p className='text-sm font-semibold text-gray-700 capitalize'>{mlHealthD?.chatbot ?? '—'}</p>
            </div>
            <div>
              <p className='text-xs text-gray-400 mb-1'>Low-conf Fallbacks</p>
              <p className='text-sm font-semibold text-amber-600'>{mlStats?.low_confidence_fallbacks ?? 0}</p>
            </div>
            <div>
              <p className='text-xs text-gray-400 mb-1'>Errors Total</p>
              <p className='text-sm font-semibold text-red-600'>{mlStats?.errors_total ?? 0}</p>
            </div>
            <div>
              <p className='text-xs text-gray-400 mb-1'>Rate Limiting</p>
              <p className='text-sm font-semibold text-gray-700'>
                {mlHealthD?.rate_limiting ? '✅ Enabled' : '⚠️ Disabled'}
              </p>
            </div>
            <div>
              <p className='text-xs text-gray-400 mb-1'>Low-conf Threshold</p>
              <p className='text-sm font-semibold text-gray-700'>{mlHealthD?.low_conf_threshold ?? 40}%</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feedback Analytics ─────────────────────────────── */}
      <section>
        <div className='flex items-center justify-between mb-4'>
          <SectionHeader icon='💬' title='Chatbot Feedback' sub={`${totalFeedback} total responses rated`} />
          {totalFeedback > 0 && (
            <button onClick={downloadFeedback} className='btn-outline text-xs flex items-center gap-1.5'>
              ⬇️ Export Dataset
            </button>
          )}
        </div>

        {totalFeedback === 0 ? (
          <div className='card text-center py-8 border-dashed border-2 border-gray-200'>
            <p className='text-gray-400 text-sm'>No feedback collected yet.</p>
            <p className='text-gray-300 text-xs mt-1'>Feedback appears when users rate MedBot responses.</p>
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div className='card'>
              <div className='grid grid-cols-3 gap-4 mb-4'>
                <div className='text-center'>
                  <p className='text-2xl font-bold text-gray-900'>{totalFeedback}</p>
                  <p className='text-xs text-gray-400'>Total ratings</p>
                </div>
                <div className='text-center'>
                  <p className='text-2xl font-bold text-green-600'>{helpfulPct}%</p>
                  <p className='text-xs text-gray-400'>Helpful rate</p>
                </div>
                <div className='text-center'>
                  <p className='text-2xl font-bold text-red-500'>{unhelpfulCount}</p>
                  <p className='text-xs text-gray-400'>Needs improvement</p>
                </div>
              </div>
              {/* Recent feedback list */}
              <div className='space-y-2 max-h-40 overflow-y-auto'>
                {feedback.slice(0, 8).map((fb, i) => (
                  <div key={fb.id || i} className='flex items-start gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-2'>
                    <span>{fb.helpful ? '👍' : '👎'}</span>
                    <p className='text-gray-600 truncate flex-1'>{fb.content?.slice(0, 80) || '(no content)'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className='card flex flex-col items-center justify-center'>
              <p className='text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3'>Feedback Distribution</p>
              <PieChart width={200} height={160}>
                <Pie data={feedbackChartData} cx='50%' cy='50%' outerRadius={60} dataKey='value' label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                  {feedbackChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </div>
          </div>
        )}
      </section>

      {/* ── Client Log Buffer ──────────────────────────────── */}
      <section>
        <SectionHeader icon='📋' title='Recent Client Logs' sub='Last 20 entries from in-memory log buffer' />
        <div className='card'>
          {logBuffer.length === 0 ? (
            <p className='text-gray-400 text-sm text-center py-4'>No log entries yet.</p>
          ) : (
            <div className='space-y-1 max-h-64 overflow-y-auto font-mono text-xs'>
              {logBuffer.map((entry, i) => (
                <div key={i} className={`flex items-start gap-2 px-2 py-1.5 rounded ${
                  entry.level === 'error'  ? 'bg-red-50 text-red-700'
                : entry.level === 'warn'   ? 'bg-amber-50 text-amber-700'
                : entry.level === 'action' ? 'bg-purple-50 text-purple-700'
                : 'bg-gray-50 text-gray-600'
                }`}>
                  <span className='w-12 flex-shrink-0 font-bold uppercase'>{entry.level}</span>
                  <span className='flex-1 truncate'>{entry.message || entry.action}</span>
                  <span className='text-gray-300 flex-shrink-0'>{entry.timestamp?.split('T')[1]?.split('.')[0]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
};

export default AdminDashboard;
