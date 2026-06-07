'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      router.push(user.setup_complete ? '/' : '/setup');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left brand panel */}
      <div className="hidden lg:flex w-80 bg-gray-950 flex-col items-start justify-between p-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">J</div>
          <span className="text-white font-bold text-base">Job Digest</span>
        </div>
        <div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Upload your resume once. Get personalised job matches every morning with AI-generated cover letters.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
            <p className="text-gray-500 text-sm mt-1">Welcome back — your digest is waiting</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password" required value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            No account?{' '}
            <Link href="/signup" className="text-indigo-600 hover:underline font-medium">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
