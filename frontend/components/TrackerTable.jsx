'use client';

function ScoreBadge({ score }) {
  const isGreen = score >= 80;
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
      isGreen ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
    }`}>
      {score}%
    </span>
  );
}

export default function TrackerTable({ jobs }) {
  if (!jobs || jobs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
        <div className="text-3xl mb-3">📋</div>
        <div className="text-gray-500 text-sm font-medium">No applications recorded yet</div>
        <div className="text-gray-400 text-xs mt-1">Mark jobs as applied from the dashboard</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date applied</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Job</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Location</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Source</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, i) => (
            <tr key={job.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-0">
              <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">
                {job.applied_at ? new Date(job.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </td>
              <td className="px-5 py-3.5">
                <div className="font-medium text-gray-900 text-sm">{job.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{job.company}</div>
              </td>
              <td className="px-5 py-3.5 text-gray-500 text-xs hidden md:table-cell">{job.location || '—'}</td>
              <td className="px-5 py-3.5"><ScoreBadge score={job.match_score} /></td>
              <td className="px-5 py-3.5 hidden sm:table-cell">
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded capitalize">{job.source}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 bg-gray-50/50">
        {jobs.length} application{jobs.length !== 1 ? 's' : ''} tracked
      </div>
    </div>
  );
}
