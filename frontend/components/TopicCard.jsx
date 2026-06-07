'use client';

export default function TopicCard({ topic }) {
  if (!topic) return (
    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 mb-6 animate-pulse h-36" />
  );

  const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(topic.topic + ' system design interview')}`;
  const gSearch = `https://www.google.com/search?q=${encodeURIComponent(topic.topic + ' system design')}`;

  return (
    <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-2xl p-5 mb-6 text-white shadow-lg shadow-indigo-900/20">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
              System Design · Today
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              topic.category === 'LLD'
                ? 'bg-purple-500/40 text-purple-200'
                : 'bg-indigo-400/30 text-indigo-200'
            }`}>
              {topic.category || 'HLD'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white leading-tight">{topic.topic}</h2>
        </div>
      </div>

      <p className="text-indigo-100 text-sm leading-relaxed mb-4">{topic.description}</p>

      {/* Key points */}
      {topic.keyPoints?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {topic.keyPoints.map((pt, i) => (
            <span key={i} className="text-xs bg-white/10 text-indigo-100 px-2.5 py-1 rounded-full backdrop-blur-sm">
              {pt}
            </span>
          ))}
        </div>
      )}

      {/* Links */}
      <div className="flex gap-2">
        <a
          href={ytSearch}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          ▶ YouTube
        </a>
        <a
          href={gSearch}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          ↗ Read up
        </a>
      </div>
    </div>
  );
}
