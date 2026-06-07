'use client';

export default function StatsBar({ stats }) {
  if (!stats) return null;

  const cards = [
    { label: 'Applied today', value: stats.appliedToday ?? 0 },
    { label: 'Applied this week', value: stats.appliedThisWeek ?? 0 },
    { label: 'Applied this month', value: stats.appliedThisMonth ?? 0 },
    { label: 'Total matched', value: stats.totalMatched ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="text-3xl font-bold text-gray-900">{card.value}</div>
          <div className="text-sm text-gray-500 mt-1">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
