import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Shield,
  ExternalLink,
  Copy,
  Check,
  Zap,
  Info,
  CheckCircle2,
  Trash2,
  AlertCircle
} from 'lucide-react';
import {
  getStoredGoogleClientId,
  setStoredGoogleClientId,
  connectWithGoogleOAuth,
  connectWithDirectToken,
  isFirebaseConfigured
} from '../services/auth';
import { AuthUser } from '../types';

interface GoogleAuthSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: AuthUser, token: string) => void;
  currentUser: AuthUser | null;
}

export const GoogleAuthSettingsModal: React.FC<GoogleAuthSettingsModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'client-id' | 'direct-token' | 'status'>('client-id');
  const [clientIdInput, setClientIdInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedOrigin, setCopiedOrigin] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setClientIdInput(getStoredGoogleClientId() || import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const handleCopyOrigin = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopiedOrigin(true);
    setTimeout(() => setCopiedOrigin(false), 2000);
  };

  const handleConnectWithClientId = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = clientIdInput.trim();
    if (!cleanId) {
      setErrorMessage('Please enter your Google OAuth Client ID.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      setStoredGoogleClientId(cleanId);
      const result = await connectWithGoogleOAuth(cleanId);
      onAuthSuccess(result.user, result.accessToken);
      onClose();
    } catch (err: unknown) {
      console.error('Google OAuth connection error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to connect with Google OAuth.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectWithToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = tokenInput.trim();
    if (!cleanToken) {
      setErrorMessage('Please paste an access token.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await connectWithDirectToken(cleanToken);
      onAuthSuccess(result.user, result.accessToken);
      onClose();
    } catch (err: unknown) {
      console.error('Direct token validation error:', err);
      const msg = err instanceof Error ? err.message : 'Invalid or expired access token.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSavedClientId = () => {
    setStoredGoogleClientId('');
    setClientIdInput('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Google Account Connection</h3>
              <p className="text-xs text-slate-500">Connect with your own personal Google credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 border-b border-slate-100 flex items-center gap-2 text-xs font-medium">
          <button
            onClick={() => { setActiveTab('client-id'); setErrorMessage(null); }}
            className={`pb-3 px-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'client-id'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Google Client ID</span>
            <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded text-[10px] font-mono">
              Recommended
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('direct-token'); setErrorMessage(null); }}
            className={`pb-3 px-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'direct-token'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Direct Access Token</span>
            <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 rounded text-[10px] font-mono">
              Fastest
            </span>
          </button>

          {currentUser && (
            <button
              onClick={() => { setActiveTab('status'); setErrorMessage(null); }}
              className={`pb-3 px-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'status'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Active Session</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* TAB 1: GOOGLE CLIENT ID */}
          {activeTab === 'client-id' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs leading-relaxed">
                <div className="font-semibold mb-1 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  Why use your own Google Client ID?
                </div>
                Google Photos requires sensitive scopes (<code className="font-mono text-[11px] bg-blue-100 px-1 rounded">drive.readonly</code>). By creating a free OAuth Client ID in your own Google Cloud account, you can access your own library immediately with <strong>zero verification restrictions</strong> and <strong>100% privacy</strong> (all tokens remain in your browser).
              </div>

              {/* 3 Step Setup Guide */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
                <div className="font-semibold text-slate-900 flex items-center justify-between">
                  <span>How to create your Client ID in 2 minutes:</span>
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 font-medium"
                  >
                    <span>Open Google Cloud Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <ol className="list-decimal list-inside space-y-2 text-slate-600">
                  <li>
                    In Google Cloud Console, enable <strong>Google Drive API</strong>.
                  </li>
                  <li>
                    Go to <strong>Credentials</strong> → <strong>Create Credentials</strong> → <strong>OAuth client ID</strong>.
                  </li>
                  <li>
                    Select <strong>Web application</strong> as Application type.
                  </li>
                  <li>
                    Under <strong>Authorized JavaScript origins</strong>, add this exact URL:
                    <div className="mt-1 flex items-center gap-2">
                      <code className="px-2.5 py-1 bg-white border border-slate-200 rounded font-mono text-slate-800 text-[11px] select-all">
                        {currentOrigin}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyOrigin}
                        className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        {copiedOrigin ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Origin</span>
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                  <li>Copy your generated <strong>Client ID</strong> and paste it below.</li>
                </ol>
              </div>

              {/* Form Input */}
              <form onSubmit={handleConnectWithClientId} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Your Google OAuth 2.0 Web Client ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1234567890-abcdefg.apps.googleusercontent.com"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Saved locally in your browser so you only need to enter it once.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  {clientIdInput && (
                    <button
                      type="button"
                      onClick={handleClearSavedClientId}
                      className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Saved Client ID</span>
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !clientIdInput.trim()}
                      className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {isLoading ? (
                        <span>Connecting...</span>
                      ) : (
                        <>
                          <Shield className="w-3.5 h-3.5" />
                          <span>Sign In & Authorize Scan</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: DIRECT ACCESS TOKEN */}
          {activeTab === 'direct-token' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs leading-relaxed">
                <div className="font-semibold mb-1 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                  Instant Test with an Access Token
                </div>
                If you don't want to create an OAuth Client ID right now, you can generate a temporary Google OAuth access token and paste it here to start deduplicating immediately.
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5 text-xs text-slate-600">
                <div className="font-semibold text-slate-900">How to get a temporary token:</div>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-slate-800 shrink-0">Option A:</span>
                    <div>
                      Open{' '}
                      <a
                        href="https://developers.google.com/oauthplayground"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                      >
                        Google OAuth 2.0 Playground <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                      , select <strong>Drive API v3</strong> (<code className="font-mono text-[10px]">https://www.googleapis.com/auth/drive.readonly</code>), click <strong>Authorize APIs</strong>, then click <strong>Exchange authorization code for tokens</strong> and copy the <strong>Access token</strong>.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-slate-800 shrink-0">Option B:</span>
                    <div>
                      From Google Cloud SDK terminal, run:{' '}
                      <code className="bg-white border px-1.5 py-0.5 rounded font-mono text-[11px] text-slate-900 select-all">
                        gcloud auth print-access-token
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleConnectWithToken} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Google OAuth Access Token (Bearer Token)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Paste ya29.a0Ac... token here"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tokens are kept in browser memory and tested against the Google Drive API before use.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !tokenInput.trim()}
                    className="px-4 py-2 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {isLoading ? (
                      <span>Verifying...</span>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>Verify & Connect</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: CURRENT SESSION STATUS */}
          {activeTab === 'status' && currentUser && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || ''}
                    className="w-12 h-12 rounded-full border border-slate-300 object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                    {currentUser.displayName?.charAt(0) || currentUser.email?.charAt(0) || 'U'}
                  </div>
                )}
                <div>
                  <div className="font-bold text-slate-900 text-sm">
                    {currentUser.displayName || 'Google User'}
                  </div>
                  <div className="text-xs text-slate-500">{currentUser.email}</div>
                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Connected via {currentUser.authProvider || 'Google OAuth'}</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600">
                You are ready to scan your Google Photos and Drive library. To switch to a different account, click "Sign Out" in the top bar.
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
