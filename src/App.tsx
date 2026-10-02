/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
} from './services/auth';
import {
  scanUniversalPhotos,
  downloadAndProcessDrivePhoto,
  fetchGoogleDrivePhotosPaged,
  processPhotosConcurrently,
  createPhotosPickerSession,
  fetchPhotosPickerMediaItems,
  clusterDuplicates,
} from './services/googlePhotos';
import { SAMPLE_PHOTOS } from './services/mockData';
import { PhotoMediaItem, DuplicateGroup, ScanStatus, ScanProgress, AuthUser } from './types';
import { Header } from './components/Header';
import { ScanController } from './components/ScanController';
import { DuplicateGroupCard } from './components/DuplicateGroupCard';
import { ComparisonModal } from './components/ComparisonModal';
import { ReportModal } from './components/ReportModal';
import { LocalPhotoDropzone } from './components/LocalPhotoDropzone';
import { AboutSection } from './components/AboutSection';
import { DestructiveActionDialog } from './components/DestructiveActionDialog';
import { GoogleAuthSettingsModal } from './components/GoogleAuthSettingsModal';
import {
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Trash2,
  Download,
  Info,
  Layers,
  ArrowRight,
  Database,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import {
  saveCachedScan,
  loadCachedScan,
  clearCachedScan
} from './services/cache';
import { formatBytes } from './services/hasher';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSettingsOpen, setIsAuthSettingsOpen] = useState(false);

  // Navigation & Modes
  const [activeTab, setActiveTab] = useState<'scan' | 'local' | 'about'>('scan');
  const [isSampleMode, setIsSampleMode] = useState(false);

  // Photos State
  const [photos, setPhotos] = useState<PhotoMediaItem[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanError, setScanError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);

  // Scan Configs
  const [batchSize, setBatchSize] = useState<number>(250);
  const [hashAlgorithm, setHashAlgorithm] = useState<'SHA-256' | 'SHA-1'>('SHA-256');
  const [useFullResDownload, setUseFullResDownload] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | 'exact-sha' | 'dimension-and-exif'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleGroupLimit, setVisibleGroupLimit] = useState<number>(30);

  // Pause ref
  const isPausedRef = React.useRef<boolean>(false);

  // Modals
  const [comparingItems, setComparingItems] = useState<PhotoMediaItem[] | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDestructiveOpen, setIsDestructiveOpen] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);

  // Progress
  const [progress, setProgress] = useState<ScanProgress>({
    totalFound: 0,
    fetchedItems: 0,
    hashesProcessed: 0,
    duplicateGroupsFound: 0,
  });

  // Auth Initialization on Mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        setAuthError(null);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Load cached scan results from IndexedDB on initial mount
  useEffect(() => {
    let isMounted = true;
    loadCachedScan().then((cached) => {
      if (isMounted && cached && cached.photos.length > 0) {
        setPhotos(cached.photos);
        setCacheTimestamp(cached.timestamp);
        setScanStatus('completed');
        setProgress({
          totalFound: cached.photos.length,
          fetchedItems: cached.photos.length,
          hashesProcessed: cached.photos.length,
          duplicateGroupsFound: 0,
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute Clusters
  const { shaGroups, exifNearGroups, totalDuplicateCount, totalSavingsBytes } = useMemo(() => {
    return clusterDuplicates(photos);
  }, [photos]);

  // Update progress duplicate group count
  useEffect(() => {
    setProgress((prev) => ({
      ...prev,
      duplicateGroupsFound: shaGroups.length + exifNearGroups.length,
    }));
  }, [shaGroups.length, exifNearGroups.length]);

  // Filtered & Searched Groups for rendering
  const displayedGroups = useMemo(() => {
    let base = [...shaGroups, ...exifNearGroups];
    if (filterType === 'exact-sha') base = shaGroups;
    if (filterType === 'dimension-and-exif') base = exifNearGroups;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return base.filter(
        (g) =>
          g.hashKey.toLowerCase().includes(q) ||
          g.items.some(
            (it) =>
              it.filename.toLowerCase().includes(q) ||
              it.exif.cameraMake?.toLowerCase().includes(q) ||
              it.exif.cameraModel?.toLowerCase().includes(q) ||
              it.sha256?.toLowerCase().includes(q)
          )
      );
    }
    return base;
  }, [filterType, shaGroups, exifNearGroups, searchQuery]);

  // Handle Sign In
  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      const msg = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
      if (msg.includes('NO_CONFIG')) {
        setIsAuthSettingsOpen(true);
      } else {
        setAuthError(msg);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setPhotos([]);
    setScanStatus('idle');
  };

  // Load Pre-populated Sample Data for Instant Testing
  const handleLoadSampleData = useCallback(() => {
    setIsSampleMode(true);
    setScanStatus('idle');
    setScanError(null);
    setPhotos(SAMPLE_PHOTOS);
    setProgress({
      totalFound: SAMPLE_PHOTOS.length,
      fetchedItems: SAMPLE_PHOTOS.length,
      hashesProcessed: SAMPLE_PHOTOS.length,
      duplicateGroupsFound: 2,
    });
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
  }, []);

  // Toggle sample mode
  const handleToggleSampleMode = (enabled: boolean) => {
    if (enabled) {
      handleLoadSampleData();
    } else {
      setIsSampleMode(false);
      setPhotos([]);
      setScanStatus('idle');
    }
  };

  // Scan Google Photos & Drive Library with support for large amounts of files
  const handleStartScan = async (appendNextBatch = false) => {
    isPausedRef.current = false;
    let currentToken = token || (await getAccessToken());
    if (!currentToken) {
      try {
        const loginRes = await googleSignIn();
        if (loginRes) {
          setUser(loginRes.user);
          setToken(loginRes.accessToken);
          currentToken = loginRes.accessToken;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('NO_CONFIG')) {
          setIsAuthSettingsOpen(true);
        } else {
          setAuthError('Please sign in with Google or configure your credentials in Settings.');
        }
        return;
      }
    }

    if (!currentToken) {
      setIsAuthSettingsOpen(true);
      return;
    }

    setScanError(null);
    setScanStatus('fetching-list');
    setIsSampleMode(false);

    try {
      const targetCount = batchSize === 0 ? Infinity : batchSize;
      const startToken = appendNextBatch ? nextPageToken : undefined;

      // 1. Fetch metadata list from Google Photos & Drive with auto-paging
      const fetchResult = await fetchGoogleDrivePhotosPaged(
        currentToken,
        targetCount,
        (fetchedCount) => {
          setProgress((prev) => ({
            ...prev,
            fetchedItems: appendNextBatch ? photos.length + fetchedCount : fetchedCount,
          }));
        },
        startToken
      );

      setNextPageToken(fetchResult.nextPageToken);

      if (fetchResult.items.length === 0) {
        setScanStatus('completed');
        return;
      }

      const initialPhotos = appendNextBatch ? [...photos, ...fetchResult.items] : fetchResult.items;
      setPhotos(initialPhotos);
      setProgress((prev) => ({
        ...prev,
        fetchedItems: initialPhotos.length,
        hashesProcessed: appendNextBatch ? photos.length : 0,
      }));

      // 2. Compute Hashes & EXIF with 5-thread concurrency pool
      setScanStatus('computing-hashes');
      const itemsToProcess = appendNextBatch ? fetchResult.items : initialPhotos;

      const processedNewItems = await processPhotosConcurrently(
        currentToken,
        itemsToProcess,
        5,
        (doneCount, currentItem) => {
          setProgress((prev) => ({
            ...prev,
            hashesProcessed: (appendNextBatch ? photos.length : 0) + doneCount,
            currentFilename: currentItem.filename,
          }));
        },
        () => isPausedRef.current
      );

      const allMerged = appendNextBatch ? [...photos, ...processedNewItems] : processedNewItems;
      setPhotos(allMerged);

      setProgress((prev) => ({
        ...prev,
        hashesProcessed: allMerged.length,
        currentFilename: undefined,
      }));

      // Persist results to IndexedDB
      await saveCachedScan(allMerged);
      setCacheTimestamp(Date.now());

      setScanStatus('completed');
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    } catch (err: unknown) {
      console.error('Scan error:', err);
      const msg = err instanceof Error ? err.message : 'An error occurred during scan.';
      setScanError(msg);
      setScanStatus('error');
    }
  };

  const handlePauseScan = () => {
    isPausedRef.current = true;
    setScanStatus('paused');
  };

  const handleClearCache = async () => {
    await clearCachedScan();
    setCacheTimestamp(null);
    setPhotos([]);
    setScanStatus('idle');
    setScanError(null);
    setNextPageToken(undefined);
    setProgress({
      totalFound: 0,
      fetchedItems: 0,
      hashesProcessed: 0,
      duplicateGroupsFound: 0,
    });
  };

  const handleResetScan = () => {
    setPhotos([]);
    setScanStatus('idle');
    setScanError(null);
    setNextPageToken(undefined);
    setProgress({
      totalFound: 0,
      fetchedItems: 0,
      hashesProcessed: 0,
      duplicateGroupsFound: 0,
    });
  };

  // Toggle selection for action
  const handleToggleSelectItem = (itemId: string) => {
    setPhotos((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, selectedForAction: !item.selectedForAction } : item
      )
    );
  };

  // Smart selection rules inside a group
  const handleSelectAllExceptOne = (
    groupId: string,
    strategy: 'keep-highest-res' | 'keep-oldest' | 'keep-newest'
  ) => {
    const targetGroup = [...shaGroups, ...exifNearGroups].find((g) => g.groupId === groupId);
    if (!targetGroup) return;

    let keeperId = targetGroup.items[0].id;

    if (strategy === 'keep-highest-res') {
      let maxMp = -1;
      let maxBytes = -1;
      for (const it of targetGroup.items) {
        if (it.megapixels > maxMp || (it.megapixels === maxMp && (it.fileSizeBytes || 0) > maxBytes)) {
          maxMp = it.megapixels;
          maxBytes = it.fileSizeBytes || 0;
          keeperId = it.id;
        }
      }
    } else if (strategy === 'keep-oldest') {
      let earliest = Infinity;
      for (const it of targetGroup.items) {
        const time = new Date(it.creationTime).getTime();
        if (time < earliest) {
          earliest = time;
          keeperId = it.id;
        }
      }
    } else if (strategy === 'keep-newest') {
      let latest = -Infinity;
      for (const it of targetGroup.items) {
        const time = new Date(it.creationTime).getTime();
        if (time > latest) {
          latest = time;
          keeperId = it.id;
        }
      }
    }

    setPhotos((prev) =>
      prev.map((it) => {
        if (targetGroup.items.some((gItem) => gItem.id === it.id)) {
          return {
            ...it,
            selectedForAction: it.id !== keeperId,
          };
        }
        return it;
      })
    );
  };

  // Handle local photos drop
  const handleLocalPhotosLoaded = async (loadedItems: PhotoMediaItem[]) => {
    const merged = [...loadedItems, ...photos];
    setPhotos(merged);
    await saveCachedScan(merged);
    setCacheTimestamp(Date.now());
    setActiveTab('scan');
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
  };

  const markedDuplicatesCount = photos.filter((p) => p.selectedForAction).length;

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-800 flex flex-col font-sans antialiased">
      {/* Top Header */}
      <Header
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onOpenAuthSettings={() => setIsAuthSettingsOpen(true)}
        isLoggingIn={isLoggingIn}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSampleMode={isSampleMode}
        onToggleSampleMode={handleToggleSampleMode}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Auth Error Banner */}
        {authError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Authentication Notice:</span> {authError}
            </div>
          </div>
        )}

        {/* Scan Error Banner */}
        {scanError && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm">
                <span className="font-bold">Scan Notice:</span> {scanError}
                <p className="mt-1 text-slate-600 text-xs">
                  If permissions were recently updated, click "Update Permissions" to refresh your Google access token.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleSignIn}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
              >
                Update Permissions
              </button>
              <button
                onClick={handleLoadSampleData}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Try Demo Data
              </button>
            </div>
          </div>
        )}

        {/* Local Dropzone Tab */}
        {activeTab === 'local' && (
          <LocalPhotoDropzone onPhotosLoaded={handleLocalPhotosLoaded} />
        )}

        {/* How It Works Tab */}
        {activeTab === 'about' && <AboutSection />}

        {/* Scan Tab */}
        {activeTab === 'scan' && (
          <>
            {/* Primary Scan Controls Bar */}
            <ScanController
              status={scanStatus}
              progress={progress}
              onStartScan={() => handleStartScan(false)}
              onPauseScan={handlePauseScan}
              onResetScan={handleResetScan}
              onLoadSampleData={handleLoadSampleData}
              isLoggedIn={!!user}
              onTriggerSignIn={handleSignIn}
              batchSize={batchSize}
              setBatchSize={setBatchSize}
              hashAlgorithm={hashAlgorithm}
              setHashAlgorithm={setHashAlgorithm}
              useFullResDownload={useFullResDownload}
              setUseFullResDownload={setUseFullResDownload}
              filterType={filterType}
              setFilterType={setFilterType}
              totalSavingsBytes={totalSavingsBytes}
              duplicateCount={totalDuplicateCount}
              totalPhotosCount={photos.length}
              onOpenReport={() => setIsReportOpen(true)}
              hasNextPage={!!nextPageToken}
              onScanNextBatch={() => handleStartScan(true)}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />

            {/* Cache Status Banner */}
            {cacheTimestamp && !isSampleMode && photos.length > 0 && (
              <div className="mb-6 px-4 py-3 bg-linear-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">
                      Scan Results Loaded from Local Storage Cache
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {photos.length} photos with computed SHA checksums and EXIF parameters (cached on{' '}
                      {new Date(cacheTimestamp).toLocaleDateString()} at{' '}
                      {new Date(cacheTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      ).
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleStartScan(false)}
                    disabled={scanStatus === 'fetching-list' || scanStatus === 'computing-hashes'}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                    <span>Re-scan Library</span>
                  </button>
                  <button
                    onClick={handleClearCache}
                    className="px-3 py-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-xl font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Clear cached scan results from browser storage"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Cache</span>
                  </button>
                </div>
              </div>
            )}

            {/* Empty State / Welcome Screen */}
            {photos.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/20">
                  <Layers className="w-8 h-8" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
                  Find Exact Google Photos Duplicates
                </h2>
                <p className="text-sm text-slate-500 max-w-lg mx-auto mb-6 leading-relaxed">
                  Analyze your media library with 256-bit cryptographic SHA hashes, pixel-for-pixel dimension verification, and deep EXIF shooting parameter diffs.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  {user ? (
                    <button
                      onClick={() => handleStartScan(false)}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
                    >
                      <span>Start Google Photos Scan</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSignIn}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
                    >
                      <span>Connect Google Photos</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={handleLoadSampleData}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-sm transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Load Demo Test Library</span>
                  </button>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-3xl mx-auto">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="font-bold text-xs uppercase tracking-wider text-blue-600">
                      Zero False Positives
                    </span>
                    <p className="text-xs text-slate-600 mt-1">
                      Cryptographic SHA-256 checks raw binary data byte-by-byte for 100% exact clones.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="font-bold text-xs uppercase tracking-wider text-purple-600">
                      Pixel Dimensions
                    </span>
                    <p className="text-xs text-slate-600 mt-1">
                      Compares exact native resolution (e.g. 4032 × 3024 px), megapixels, and aspect ratios.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="font-bold text-xs uppercase tracking-wider text-emerald-600">
                      Deep EXIF Diff
                    </span>
                    <p className="text-xs text-slate-600 mt-1">
                      Diffs camera model, ISO, focal length, aperture, shutter speed, and timestamp.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Results Section */}
            {photos.length > 0 && (
              <div>
                {/* Floating Bottom Action Bar when items are marked for duplicate cleanup */}
                {markedDuplicatesCount > 0 && (
                  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700 animate-in slide-in-from-bottom-5">
                    <div className="text-xs">
                      <span className="font-bold text-red-400">{markedDuplicatesCount}</span> duplicate copies marked for cleanup
                    </div>
                    <button
                      onClick={() => setIsDestructiveOpen(true)}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Review Cleanup Action</span>
                    </button>
                    <button
                      onClick={() => setIsReportOpen(true)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors"
                    >
                      Export List
                    </button>
                  </div>
                )}

                {/* Duplicate Clusters Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Duplicate Clusters ({displayedGroups.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      {displayedGroups.length === 0
                        ? 'No duplicates found matching this filter.'
                        : 'Review clusters below. Click "Deep Diff" to inspect pixel dimensions and EXIF side-by-side.'}
                    </p>
                  </div>

                  {displayedGroups.length > 0 && (
                    <button
                      onClick={() => setIsReportOpen(true)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Report</span>
                    </button>
                  )}
                </div>

                {/* Render Duplicate Groups (paginated for high performance with large libraries) */}
                {displayedGroups.slice(0, visibleGroupLimit).map((group) => (
                  <DuplicateGroupCard
                    key={group.groupId}
                    group={group}
                    onCompare={(groupItems) => setComparingItems(groupItems)}
                    onToggleSelectItem={handleToggleSelectItem}
                    onSelectAllExceptOne={handleSelectAllExceptOne}
                  />
                ))}

                {/* Show More Clusters Button for Large Amounts of Files */}
                {displayedGroups.length > visibleGroupLimit && (
                  <div className="text-center py-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => setVisibleGroupLimit((prev) => prev + 30)}
                      className="px-6 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
                    >
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                      <span>
                        Show Next 30 Clusters ({Math.min(visibleGroupLimit, displayedGroups.length)} of {displayedGroups.length} displayed)
                      </span>
                    </button>
                    <button
                      onClick={() => setVisibleGroupLimit(displayedGroups.length)}
                      className="px-4 py-2.5 text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      Show All ({displayedGroups.length})
                    </button>
                  </div>
                )}

                {/* All photos unique message */}
                {displayedGroups.length === 0 && photos.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <h4 className="font-bold text-slate-900 text-base">No Duplicates Found</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      All {photos.length} analyzed photos possess distinct cryptographic hashes or unique dimensions.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Side-by-Side Deep Diff Modal (Pixel dimensions & EXIF matrix) */}
      {comparingItems && (
        <ComparisonModal
          items={comparingItems}
          isOpen={!!comparingItems}
          onClose={() => setComparingItems(null)}
          onToggleSelectItem={handleToggleSelectItem}
        />
      )}

      {/* Export Report Modal */}
      {isReportOpen && (
        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          groups={[...shaGroups, ...exifNearGroups]}
          allPhotos={photos}
        />
      )}

      {/* Destructive Cleanup Confirmation Dialog */}
      {isDestructiveOpen && (
        <DestructiveActionDialog
          isOpen={isDestructiveOpen}
          onClose={() => setIsDestructiveOpen(false)}
          onConfirm={() => {
            setIsDestructiveOpen(false);
            setIsReportOpen(true);
          }}
          selectedItems={photos.filter((p) => p.selectedForAction)}
        />
      )}

      {/* Google Authentication & Credentials Settings Modal */}
      <GoogleAuthSettingsModal
        isOpen={isAuthSettingsOpen}
        onClose={() => setIsAuthSettingsOpen(false)}
        currentUser={user}
        onAuthSuccess={(authUser, authToken) => {
          setUser(authUser);
          setToken(authToken);
          setAuthError(null);
          confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">PhotoSHA</span>
            <span>•</span>
            <span>Cryptographic SHA-256 & EXIF Google Photos Duplicate Finder</span>
          </div>
          <div>
            Built with Web Crypto API, Google Photos Library API & TypeScript
          </div>
        </div>
      </footer>
    </div>
  );
}
