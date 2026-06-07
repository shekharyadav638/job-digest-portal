'use client';
import Link from 'next/link';

function ScorePill({ score }) {
  const isGreen = score >= 80;
  return (
    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${
      isGreen ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'
    }`}>
      <span className={`text-base font-bold leading-none ${isGreen ? 'text-emerald-600' : 'text-amber-600'}`}>
        {score}
      </span>
      <span className={`text-[9px] font-medium ${isGreen ? 'text-emerald-500' : 'text-amber-500'}`}>
        %
      </span>
    </div>
  );
}

export default function JobCard({ job }) {
  return (
    <div className={`flex items-center gap-4 px-5 py-4 group hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
      job.applied === 1 ? 'bg-emerald-50/40' : 'bg-white'
    }`}>
      <ScorePill score={job.match_score} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm truncate">{job.title}</span>
          {job.applied === 1 && (
            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
              Applied ✓
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-gray-700">{job.company}</span>
          {job.location && <><span className="text-gray-300">·</span><span>{job.location}</span></>}
          {job.salary && <><span className="text-gray-300">·</span><span className="text-emerald-600 font-medium">{job.salary}</span></>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="hidden sm:inline-block text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded capitalize">
          {job.source}
        </span>
        <Link
          href={`/jobs/${job.id}`}
          className="text-xs font-semibold bg-gray-900 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          View →
        </Link>
      </div>
    </div>
  );
}
