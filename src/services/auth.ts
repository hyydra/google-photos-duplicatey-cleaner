import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import baseConfig from '../../firebase-applet-config.json';
import { AuthUser } from '../types';

declare global {
  interface Window {
    google?: any;
  }
}

const STORAGE_KEY_CLIENT_ID = 'photosha_google_client_id';
const STORAGE_KEY_SESSION_USER = 'photosha_session_user';

export const getStoredGoogleClientId = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY_CLIENT_ID) || '';
};

export const setStoredGoogleClientId = (clientId: string): void => {
  if (typeof window === 'undefined') return;
  const clean = clientId.trim();
  if (clean) {
    localStorage.setItem(STORAGE_KEY_CLIENT_ID, clean);
  } else {
    localStorage.removeItem(STORAGE_KEY_CLIENT_ID);
  }
};

export const getEffectiveGoogleClientId = (): string => {
  return (
    getStoredGoogleClientId() ||
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID ||
    ''
  );
};

export const hasConfiguredGoogleAuth = (): boolean => {
  return !!getEffectiveGoogleClientId() || isFirebaseConfigured();
};

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || baseConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || baseConfig.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || baseConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || baseConfig.authDomain,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || baseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || baseConfig.messagingSenderId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || baseConfig.measurementId || '',
};

const app = (() => {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.trim() !== '') {
    return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  }
  return null;
})();

let authInstance: ReturnType<typeof getAuth> | null = null;

export const isFirebaseConfigured = (): boolean => {
  return !!(firebaseConfig.apiKey && firebaseConfig.apiKey.trim() !== '');
};

export const getFirebaseAuth = () => {
  if (!authInstance && app) {
    try {
      authInstance = getAuth(app);
    } catch (e) {
      console.warn('Could not initialize Firebase Auth:', e);
      authInstance = null;
    }
  }
  return authInstance;
};

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/photospicker.mediaitems.readonly');
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'online'
});

// In-memory token cache (never stored in localStorage for security)
let cachedAccessToken: string | null = null;
let currentUser: AuthUser | null = null;
let isSigningIn = false;

export function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (window.google?.accounts?.oauth2) {
      return resolve();
    }
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      const checkLoaded = () => {
        if (window.google?.accounts?.oauth2) {
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) {
        resolve();
      } else {
        setTimeout(() => resolve(), 200);
      }
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services library.'));
    document.head.appendChild(script);
  });
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<AuthUser> {
  // 1. Try oauth2 userinfo
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        id: data.sub,
        displayName: data.name || data.email,
        email: data.email,
        photoURL: data.picture,
        authProvider: 'google-oauth',
      };
    }
  } catch {
    // fallback
  }

  // 2. Fallback to Drive about endpoint
  try {
    const driveRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (driveRes.ok) {
      const data = await driveRes.json();
      if (data.user) {
        return {
          id: data.user.permissionId,
          displayName: data.user.displayName || data.user.emailAddress,
          email: data.user.emailAddress,
          photoURL: data.user.photoLink,
          authProvider: 'google-oauth',
        };
      }
    }
  } catch {
    // fallback
  }

  return {
    displayName: 'Google Account',
    email: 'google-account@connected',
    authProvider: 'google-oauth',
  };
}

/**
 * Connects to Google using Google Identity Services (GIS) Token Client.
 * Any user can supply their own Google Cloud OAuth 2.0 Web Client ID.
 */
export async function connectWithGoogleOAuth(
  customClientId?: string
): Promise<{ user: AuthUser; accessToken: string }> {
  const activeClientId =
    customClientId?.trim() ||
    getEffectiveGoogleClientId();

  if (!activeClientId) {
    throw new Error(
      'NO_CONFIG: No Google OAuth Client ID found. Please provide a Google Client ID in settings.'
    );
  }

  await loadGsiScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services SDK could not be loaded. Check your internet connection.');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope:
          'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/photospicker.mediaitems.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }
          if (!tokenResponse.access_token) {
            reject(new Error('No access token returned from Google.'));
            return;
          }

          const accessToken = tokenResponse.access_token;
          cachedAccessToken = accessToken;

          if (customClientId) {
            setStoredGoogleClientId(customClientId);
          }

          try {
            const user = await fetchGoogleUserInfo(accessToken);
            currentUser = user;
            sessionStorage.setItem(STORAGE_KEY_SESSION_USER, JSON.stringify(user));
            resolve({ user, accessToken });
          } catch {
            const fallbackUser: AuthUser = {
              displayName: 'Google User',
              authProvider: 'google-oauth',
            };
            currentUser = fallbackUser;
            sessionStorage.setItem(STORAGE_KEY_SESSION_USER, JSON.stringify(fallbackUser));
            resolve({ user: fallbackUser, accessToken });
          }
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || 'Google Sign-In popup closed or blocked.'));
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Connects directly using a Google OAuth Access Token (e.g. from Google OAuth Playground or gcloud).
 */
export async function connectWithDirectToken(
  token: string
): Promise<{ user: AuthUser; accessToken: string }> {
  const cleanToken = token.trim().replace(/^Bearer\s+/i, '');
  if (!cleanToken) {
    throw new Error('Please enter a valid Google OAuth Access Token.');
  }

  // Validate token against Drive API
  const driveCheck = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { Authorization: `Bearer ${cleanToken}` },
  });

  if (!driveCheck.ok) {
    const errorText = await driveCheck.text();
    let msg = `Invalid Token (${driveCheck.status}): Ensure the token is active and includes the drive.readonly scope.`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.message) msg = parsed.error.message;
    } catch {}
    throw new Error(msg);
  }

  const user = await fetchGoogleUserInfo(cleanToken);
  user.authProvider = 'manual-token';
  cachedAccessToken = cleanToken;
  currentUser = user;
  sessionStorage.setItem(STORAGE_KEY_SESSION_USER, JSON.stringify(user));

  return { user, accessToken: cleanToken };
}

export const initAuth = (
  onAuthSuccess?: (user: AuthUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check session storage first
  if (typeof window !== 'undefined') {
    const savedUserJson = sessionStorage.getItem(STORAGE_KEY_SESSION_USER);
    if (savedUserJson && cachedAccessToken) {
      try {
        const savedUser: AuthUser = JSON.parse(savedUserJson);
        currentUser = savedUser;
        if (onAuthSuccess) onAuthSuccess(savedUser, cachedAccessToken);
        return () => {};
      } catch {}
    }
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }

  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        const authUser: AuthUser = {
          id: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          authProvider: 'firebase',
        };
        currentUser = authUser;
        if (onAuthSuccess) onAuthSuccess(authUser, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        currentUser = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      if (!cachedAccessToken) {
        currentUser = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

/**
 * Universal sign-in: uses custom/configured Google Client ID if available,
 * otherwise falls back to Firebase if configured, or prompts configuration.
 */
export const googleSignIn = async (): Promise<{ user: AuthUser; accessToken: string } | null> => {
  const clientId = getEffectiveGoogleClientId();

  // 1. If Google OAuth Client ID is configured, use Google Identity Services (cleanest, no Firebase needed)
  if (clientId) {
    return await connectWithGoogleOAuth(clientId);
  }

  // 2. If Firebase is configured, fall back to Firebase popup
  const auth = getFirebaseAuth();
  if (auth) {
    try {
      isSigningIn = true;
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to retrieve access token from Google Sign-In.');
      }

      cachedAccessToken = credential.accessToken;
      const authUser: AuthUser = {
        id: result.user.uid,
        displayName: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
        authProvider: 'firebase',
      };
      currentUser = authUser;
      sessionStorage.setItem(STORAGE_KEY_SESSION_USER, JSON.stringify(authUser));
      return { user: authUser, accessToken: cachedAccessToken };
    } catch (error: unknown) {
      console.error('Google Sign-in error:', error);
      throw error;
    } finally {
      isSigningIn = false;
    }
  }

  // 3. No credentials configured yet
  throw new Error('NO_CONFIG: Please configure your Google Client ID or access token in Settings.');
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentUser = (): AuthUser | null => {
  return currentUser;
};

export const logout = async () => {
  const auth = getFirebaseAuth();
  if (auth) {
    try {
      await signOut(auth);
    } catch {}
  }
  cachedAccessToken = null;
  currentUser = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEY_SESSION_USER);
  }
};
