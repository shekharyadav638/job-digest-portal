'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '../components/PortalShell';
import TopicCard from '../components/TopicCard';
import JobCard from '../components/JobCard';
import { useAuth, API } from '../context/AuthContext';

const JOB_FILTERS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Applied', value: 'applied' },
  { label: 'All',     value: 'all'     },
];

export default function Dashboard() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState([]);
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [jobFilter, setJobFilter] = useState('pending');

  const today = new Date().toISOString().split('T')[0];
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (!authLoading && user && !user.setup_complete) router.push('/setup');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token || !user?.setup_complete) return;
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/api/jobs?date=${today}`, { headers: h }).then(r => r.json()),
      fetch(`${API}/api/topic/today`, { headers: h }).then(r => r.json()),
    ])
      .then(([j, t]) => {
        setJobs(Array.isArray(j) ? j : []);
        setTopic(t?.error ? null : t);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [token, user, today]);

  async function triggerDigest() {
    setTriggering(true);
    try {
      await fetch(`${API}/api/cron/trigger`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setTriggering(false);
    }
  }

  // Client-side counts
  const pendingJobs  = jobs.filter(j => j.applied !== 1);
  const appliedJobs  = jobs.filter(j => j.applied === 1);
  const filteredJobs = jobFilter === 'all' ? jobs : jobFilter === 'applied' ? appliedJobs : pendingJobs;

  const filterCounts = { pending: pendingJobs.length, applied: appliedJobs.length, all: jobs.length };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <PortalShell>
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            Good morning, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{todayLabel}</p>
        </div>
        <button
          onClick={triggerDigest}
          disabled={triggering}
          className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {triggering
            ? <><span className="animate-spin inline-block">↻</span> Fetching...</>
            : '↻ Run digest'}
        </button>
      </div>

      <div className="px-8 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
            Backend error: {error}
          </div>
        )}

        {/* System design topic */}
        <TopicCard topic={loading ? null : topic} />

        {/* Jobs header — filter tabs + cron note */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Today's matched jobs</h2>

            {/* Filter tabs */}
            {!loading && jobs.length > 0 && (
              <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
                {JOB_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setJobFilter(f.value)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                      jobFilter === f.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {f.label}
                    <span className={`ml-1 ${jobFilter === f.value ? 'text-gray-500' : 'text-gray-400'}`}>
                      ({filterCounts[f.value]})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cron note */}
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <span>⏰</span> Auto-refreshes every morning at 7am IST
          </p>
        </div>

        {/* Job list */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-0 animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="h-7 bg-gray-100 rounded-lg w-16" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-gray-700 font-medium text-sm">No jobs fetched for today yet</div>
            <div className="text-gray-400 text-xs mt-1.5 mb-5">
              Jobs are fetched automatically at 7am IST. Trigger manually below.
            </div>
            <button
              onClick={triggerDigest}
              disabled={triggering}
              className="text-sm font-semibold bg-gray-900 text-white px-5 py-2.5 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {triggering ? 'Fetching...' : 'Fetch jobs now'}
            </button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <div className="text-2xl mb-2">
              {jobFilter === 'applied' ? '✅' : '📋'}
            </div>
            <div className="text-gray-500 text-sm">
              {jobFilter === 'applied'
                ? 'No jobs marked as applied yet.'
                : 'All jobs have been applied to — great work!'}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {filteredJobs.map(job => <JobCard key={job.id} job={job} />)}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
