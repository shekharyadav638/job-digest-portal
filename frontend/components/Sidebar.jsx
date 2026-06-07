'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, API } from '../context/AuthContext';

function StatRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${highlight ? 'text-indigo-400' : 'text-gray-200'}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function NavItem({ href, icon, label, active }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-gray-800 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
      }`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const { user, token, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, [token]);

  const preferredRoles = user?.preferred_roles
    ? JSON.parse(user.preferred_roles).slice(0, 2).join(', ')
    : null;

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-gray-950 flex flex-col h-screen sticky top-0 overflow-y-auto scrollbar-thin">
      {/* Brand */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">J</div>
          <span className="text-white font-bold text-base tracking-tight">Job Digest</span>
        </div>
      </div>

      {/* User info */}
      {user && (
        <div className="mx-3 mb-4 p-3 bg-gray-900 rounded-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-semibold truncate">{user.name}</div>
              {preferredRoles && (
                <div className="text-gray-500 text-xs truncate">{preferredRoles}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="px-3 space-y-0.5 mb-4">
        <NavItem href="/" icon="⌂" label="Dashboard" active={pathname === '/'} />
        <NavItem href="/tracker" icon="≡" label="Tracker" active={pathname === '/tracker'} />
        <NavItem href="/settings" icon="⚙" label="Settings" active={pathname === '/settings'} />
      </nav>

      <div className="mx-3 border-t border-gray-800 mb-4" />

      {/* Stats */}
      <div className="px-4 flex-1">
        <div className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-2">Stats</div>
        <StatRow label="Applied today" value={stats?.appliedToday} highlight />
        <StatRow label="This week" value={stats?.appliedThisWeek} />
        <StatRow label="This month" value={stats?.appliedThisMonth} />
        <div className="border-t border-gray-800/60 my-2" />
        <StatRow label="Total matched" value={stats?.totalMatched} />
        <StatRow label="Total applied" value={stats?.totalApplied} />
      </div>

      {/* Sign out */}
      <div className="px-3 pb-6 pt-4 mt-auto">
        <div className="border-t border-gray-800 mb-4" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-500 hover:text-white hover:bg-gray-800/60 transition-colors"
        >
          <span>↪</span> Sign out
        </button>
      </div>
    </aside>
  );
}
