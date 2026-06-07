'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '../../components/PortalShell';
import TrackerTable from '../../components/TrackerTable';
import { useAuth, API } from '../../context/AuthContext';

const FILTERS = [
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'All time', value: 'all' },
];

export default function Tracker() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API}/api/stats/applied?filter=${filter}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setJobs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter, token]);

  return (
    <PortalShell>
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-8 py-4">
        <h1 className="text-base font-semibold text-gray-900">Application history</h1>
        <p className="text-xs text-gray-400 mt-0.5">Track every job you've applied to</p>
      </div>

      <div className="px-8 py-6">
        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all ${
                filter === f.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4 px-5 py-4 border-b border-gray-100 last:border-0 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-24" />
                <div className="h-3 bg-gray-100 rounded w-40" />
                <div className="h-3 bg-gray-100 rounded w-28" />
              </div>
            ))}
          </div>
        ) : (
          <TrackerTable jobs={jobs} />
        )}
      </div>
    </PortalShell>
  );
}
