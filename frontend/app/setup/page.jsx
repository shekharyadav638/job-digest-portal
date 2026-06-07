'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600'
      }`}
    >
      {label}
    </button>
  );
}

export default function SetupPage() {
  const { user, token, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1); // 1=upload resume, 2=select roles
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [suggestedRoles, setSuggestedRoles] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [customRole, setCustomRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (!authLoading && user?.setup_complete) router.push('/');
  }, [authLoading, user, router]);

  async function handleResumeUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
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

      setSuggestedRoles(data.suggestedRoles || []);
      setSelectedRoles(data.suggestedRoles?.slice(0, 4) || []);
      setStep(2);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
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

  async function handleSave() {
    if (selectedRoles.length === 0) {
      setSaveError('Please select at least one job role.');
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      const res = await fetch(`${API}/api/profile/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ preferredRoles: selectedRoles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      refreshUser(data.user);
      router.push('/');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // All roles to show: AI-suggested + common defaults, deduplicated
  const allRolesToShow = [...new Set([...suggestedRoles, ...COMMON_ROLES])];

  if (authLoading) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
              }`}>{s}</div>
              {s < 2 && <div className={`w-12 h-0.5 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Upload resume */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Upload your resume</h1>
            <p className="text-sm text-gray-500 mb-6">
              We'll read your resume and suggest job roles tailored to your skills and experience.
              Supported formats: PDF, TXT (max 5MB).
            </p>

            {uploadError && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4">
                {uploadError}
              </div>
            )}

            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <div className="space-y-2">
                  <div className="text-3xl">⏳</div>
                  <div className="text-gray-600 font-medium">Parsing your resume with AI...</div>
                  <div className="text-gray-400 text-sm">This takes about 10-15 seconds</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-4xl">📄</div>
                  <div className="text-gray-700 font-medium">Click to upload your resume</div>
                  <div className="text-gray-400 text-sm">PDF or TXT, max 5MB</div>
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
          </div>
        )}

        {/* Step 2: Select roles */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Choose job roles you want</h1>
            <p className="text-sm text-gray-500 mb-1">
              We've pre-selected roles based on your resume. You can add or remove any.
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Selected: {selectedRoles.length} role{selectedRoles.length !== 1 ? 's' : ''}
            </p>

            {/* AI-suggested section */}
            {suggestedRoles.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
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

            {/* Other common roles */}
            <div className="mb-6">
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

            {/* Custom role input */}
            <div className="mb-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Add a custom role
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customRole}
                  onChange={e => setCustomRole(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomRole())}
                  placeholder="e.g. Rails Developer"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <div className="text-xs font-semibold text-blue-700 mb-2">
                  Jobs will be fetched for these roles:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRoles.map(role => (
                    <span key={role} className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {role}
                      <button type="button" onClick={() => toggleRole(role)} className="hover:text-blue-200">×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {saveError && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4">
                {saveError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || selectedRoles.length === 0}
                className="flex-1 bg-gray-900 hover:bg-gray-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : `Save preferences & go to dashboard →`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
