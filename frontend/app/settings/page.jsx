'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '../../components/PortalShell';
import { useAuth, API } from '../../context/AuthContext';

const COMMON_ROLES = [
  'Software Engineer', 'Backend Engineer', 'Frontend Engineer',
  'Full Stack Developer', 'SDE-1', 'Junior Developer', 'Associate Engineer',
  'Node.js Developer', 'React Developer', 'Python Developer',
  'Java Developer', 'DevOps Engineer', 'Cloud Engineer', 'Data Engineer',
];

function RoleChip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
        selected
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'
      }`}
    >
      {label}
    </button>
  );
}

export default function SettingsPage() {
  const { user, token, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const fileRef = useRef();

  // Resume section state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [newSuggestedRoles, setNewSuggestedRoles] = useState([]);

  // Roles section state
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [customRole, setCustomRole] = useState('');
  const [savingRoles, setSavingRoles] = useState(false);
  const [rolesError, setRolesError] = useState('');
  const [rolesSuccess, setRolesSuccess] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  // Pre-populate roles from user profile
  useEffect(() => {
    if (user?.preferred_roles) {
      try {
        const parsed = JSON.parse(user.preferred_roles);
        setSelectedRoles(Array.isArray(parsed) ? parsed : []);
      } catch {
        setSelectedRoles([]);
      }
    }
  }, [user]);

  async function handleResumeUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setUploadSuccess('');
    setNewSuggestedRoles([]);
    setUploading(true);

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await fetch(`${API}/api/profile/resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      const suggested = data.suggestedRoles || [];
      setNewSuggestedRoles(suggested);

      // Merge new AI-suggested roles with existing selected roles
      setSelectedRoles(prev => [...new Set([...suggested.slice(0, 4), ...prev])]);
      setUploadSuccess(`Resume updated — ${file.name}`);

      // Refresh user to get updated resume_filename
      const meRes = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (meRes.ok) refreshUser(await meRes.json());
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      // Reset file input so same file can be re-uploaded
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function toggleRole(role) {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }

  function addCustomRole() {
    const trimmed = customRole.trim();
    if (!trimmed || selectedRoles.includes(trimmed)) return;
    setSelectedRoles(prev => [...prev, trimmed]);
    setCustomRole('');
  }

  async function handleSaveRoles() {
    if (selectedRoles.length === 0) {
      setRolesError('Please select at least one role.');
      return;
    }
    setSavingRoles(true);
    setRolesError('');
    setRolesSuccess('');

    try {
      const res = await fetch(`${API}/api/profile/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ preferredRoles: selectedRoles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      refreshUser(data.user);
      setRolesSuccess('Roles saved! New jobs will be matched against these roles.');
    } catch (err) {
      setRolesError(err.message);
    } finally {
      setSavingRoles(false);
    }
  }

  const suggestedRoles = newSuggestedRoles.length > 0
    ? newSuggestedRoles
    : (user?.suggested_roles ? (() => { try { return JSON.parse(user.suggested_roles); } catch { return []; } })() : []);

  const allRolesToShow = [...new Set([...suggestedRoles, ...COMMON_ROLES])];

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <PortalShell>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-8 py-4">
        <h1 className="text-base font-semibold text-gray-900">Settings</h1>
        <p className="text-xs text-gray-400 mt-0.5">Update your resume and job preferences</p>
      </div>

      <div className="px-8 py-6 max-w-2xl space-y-8">

        {/* ── Resume section ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Resume</h2>
          <p className="text-xs text-gray-400 mb-4">
            Upload a new resume to update your profile. AI will re-extract your skills and suggest fresh roles.
          </p>

          {/* Current resume */}
          {user?.resume_filename && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-4">
              <span className="text-xl">📄</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{user.resume_filename}</div>
                <div className="text-xs text-gray-400">Current resume on file</div>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors disabled:opacity-50"
              >
                Replace
              </button>
            </div>
          )}

          {uploadError && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100 mb-3">
              {uploadError}
            </div>
          )}
          {uploadSuccess && (
            <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-xl border border-emerald-100 mb-3">
              {uploadSuccess} — AI has re-extracted your profile and suggested roles below.
            </div>
          )}

          {/* Upload drop zone */}
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <div className="space-y-1.5">
                <div className="text-2xl">⏳</div>
                <div className="text-gray-600 text-sm font-medium">Parsing resume with AI...</div>
                <div className="text-gray-400 text-xs">This takes about 10–15 seconds</div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-2xl">⬆</div>
                <div className="text-gray-700 text-sm font-medium">
                  {user?.resume_filename ? 'Upload a new resume' : 'Upload your resume'}
                </div>
                <div className="text-gray-400 text-xs">PDF or TXT, max 5MB</div>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="hidden"
            onChange={handleResumeUpload}
            disabled={uploading}
          />
        </section>

        <div className="border-t border-gray-100" />

        {/* ── Roles section ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Preferred job roles</h2>
          <p className="text-xs text-gray-400 mb-4">
            Jobs are fetched and scored for these roles every morning. Changes take effect from the next digest run.
          </p>

          {/* AI-suggested */}
          {suggestedRoles.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                AI suggested from your resume
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedRoles.map(role => (
                  <RoleChip
                    key={role}
                    label={role}
                    selected={selectedRoles.includes(role)}
                    onClick={() => toggleRole(role)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Common roles */}
          <div className="mb-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Other common roles
            </div>
            <div className="flex flex-wrap gap-2">
              {COMMON_ROLES.filter(r => !suggestedRoles.includes(r)).map(role => (
                <RoleChip
                  key={role}
                  label={role}
                  selected={selectedRoles.includes(role)}
                  onClick={() => toggleRole(role)}
                />
              ))}
            </div>
          </div>

          {/* Custom role */}
          <div className="mb-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add a custom role</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customRole}
                onChange={e => setCustomRole(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomRole())}
                placeholder="e.g. Rails Developer"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={addCustomRole}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Selected roles preview */}
          {selectedRoles.length > 0 && (
            <div className="bg-indigo-50 rounded-xl p-4 mb-4">
              <div className="text-xs font-semibold text-indigo-700 mb-2">
                Jobs will be fetched for these {selectedRoles.length} role{selectedRoles.length !== 1 ? 's' : ''}:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedRoles.map(role => (
                  <span key={role} className="inline-flex items-center gap-1 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {role}
                    <button type="button" onClick={() => toggleRole(role)} className="hover:text-indigo-200">×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {rolesError && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100 mb-3">
              {rolesError}
            </div>
          )}
          {rolesSuccess && (
            <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-xl border border-emerald-100 mb-3">
              {rolesSuccess}
            </div>
          )}

          <button
            onClick={handleSaveRoles}
            disabled={savingRoles || selectedRoles.length === 0}
            className="bg-gray-900 hover:bg-gray-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {savingRoles ? 'Saving...' : 'Save roles'}
          </button>
        </section>
      </div>
    </PortalShell>
  );
}
