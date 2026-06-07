'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PortalShell from '../../../components/PortalShell';
import { useAuth, API } from '../../../context/AuthContext';

function ScoreBadge({ score }) {
  const isGreen = score >= 80;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full ${
      isGreen ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
    }`}>
      {score}% match
    </span>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/jobs/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setJob(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id, token]);

  async function handleApply() {
    setApplying(true);
    const res = await fetch(`${API}/api/jobs/${id}/apply`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ applied: job.applied !== 1 }),
    });
    setJob(await res.json());
    setApplying(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(job.cover_letter || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (authLoading || loading) {
    return (
      <PortalShell>
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>
      </PortalShell>
    );
  }

  if (!job || job.error) {
    return (
      <PortalShell>
        <div className="px-8 py-6">
          <div className="text-gray-500 text-sm">Job not found.</div>
          <Link href="/" className="text-indigo-600 hover:underline text-sm mt-2 block">← Back to dashboard</Link>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm transition-colors">← Back</Link>
        <div className="h-4 w-px bg-gray-200" />
        <span className="text-sm font-medium text-gray-900 truncate">{job.title}</span>
      </div>

      <div className="px-8 py-6 max-w-4xl">
        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 mb-1">{job.title}</h1>
              <div className="text-gray-600 text-sm mb-3">
                {job.company}
                {job.location && <span className="text-gray-400"> · {job.location}</span>}
                {job.salary && <span className="text-emerald-600 font-medium"> · {job.salary}</span>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ScoreBadge score={job.match_score} />
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full capitalize">{job.source}</span>
                {job.applied === 1 && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-1 rounded-full">Applied ✓</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 flex-shrink-0">
              <a
                href={job.apply_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 px-5 rounded-xl transition-colors"
              >
                Apply Now →
              </a>
              <button
                onClick={handleApply}
                disabled={applying}
                className={`text-center text-sm font-medium py-2.5 px-5 rounded-xl border transition-colors ${
                  job.applied === 1
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {applying ? '...' : job.applied === 1 ? 'Applied ✓ (undo)' : 'Mark as Applied'}
              </button>
            </div>
          </div>

          {job.match_reason && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500 italic">
              {job.match_reason}
            </div>
          )}
        </div>

        {/* Job description + cover letter side by side on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Job Description</h2>
            <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto scrollbar-thin">
              {job.description || 'No description available.'}
            </div>
          </div>

          {job.cover_letter && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 text-sm">Personalised Cover Letter</h2>
                <button
                  onClick={handleCopy}
                  className={`text-xs font-semibold px-3 py-1 rounded-lg border transition-all ${
                    copied
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <textarea
                readOnly
                value={job.cover_letter}
                className="w-full text-sm text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 rounded-xl p-4 resize-none focus:outline-none max-h-96 scrollbar-thin"
                rows={12}
              />
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
