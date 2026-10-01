/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
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
  createPhotosPickerSession,
  fetchPhotosPickerMediaItems,
  clusterDuplicates,
} from './services/googlePhotos';
import { SAMPLE_PHOTOS } from './services/mockData';
import { PhotoMediaItem, DuplicateGroup, ScanStatus, ScanProgress } from './types';
import { Header } from './components/Header';
import { ScanController } from './components/ScanController';
import { DuplicateGroupCard } from './components/DuplicateGroupCard';
import { ComparisonModal } from './components/ComparisonModal';
import { ReportModal } from './components/ReportModal';
import { LocalPhotoDropzone } from './components/LocalPhotoDropzone';
import { AboutSection } from './components/AboutSection';
import { DestructiveActionDialog } from './components/DestructiveActionDialog';
import {
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Trash2,
  Download,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import { formatBytes } from './services/hasher';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Navigation & Modes
  const [activeTab, setActiveTab] = useState<'scan' | 'local' | 'about'>('scan');
  const [isSampleMode, setIsSampleMode] = useState(false);

  // Photos State
  const [photos, setPhotos] = useState<PhotoMediaItem[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanError, setScanError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);

  // Scan Configs
  const [batchSize, setBatchSize] = useState<number>(25);
  const [hashAlgorithm, setHashAlgorithm] = useState<'SHA-256' | 'SHA-1'>('SHA-256');
  const [useFullResDownload, setUseFullResDownload] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | 'exact-sha' | 'dimension-and-exif'>('all');

  // Modals
  const [comparingItems, setComparingItems] = useState<PhotoMediaItem[] | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDestructiveOpen, setIsDestructiveOpen] = useState(false);

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

  // Filtered Groups for rendering
  const displayedGroups = useMemo(() => {
    if (filterType === 'exact-sha') return shaGroups;
    if (filterType === 'dimension-and-exif') return exifNearGroups;
    return [...shaGroups, ...exifNearGroups];
  }, [filterType, shaGroups, exifNearGroups]);

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
      setAuthError(msg);
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

  // Scan Google Photos & Drive Library
  const handleStartScan = async () => {
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
        setAuthError('Please sign in with Google to grant access to your photos.');
        return;
      }
    }

    if (!currentToken) {
      setAuthError('Authentication required. Please sign in with Google.');
      return;
    }

    setScanError(null);
    setScanStatus('fetching-list');
    setIsSampleMode(false);

    try {
      // 1. Fetch metadata list from Google Photos & Drive storage
      const fetchResult = await scanUniversalPhotos(currentToken, batchSize, nextPageToken);
      setNextPageToken(fetchResult.nextPageToken);

      if (fetchResult.items.length === 0) {
        setScanStatus('completed');
        return;
      }

      setPhotos(fetchResult.items);
      setProgress((prev) => ({
        ...prev,
        fetchedItems: fetchResult.items.length,
        hashesProcessed: 0,
      }));

      // 2. Compute Hashes & EXIF sequentially to avoid browser thread locks
      setScanStatus('computing-hashes');
      const processedItems: PhotoMediaItem[] = [...fetchResult.items];

      for (let i = 0; i < processedItems.length; i++) {
        const item = processedItems[i];
        setProgress((prev) => ({
          ...prev,
          hashesProcessed: i,
          currentFilename: item.filename,
        }));

        const processed = await downloadAndProcessDrivePhoto(currentToken, item);
        processedItems[i] = processed;

        // Update state in chunks so UI updates live
        setPhotos([...processedItems]);
      }

      setProgress((prev) => ({
        ...prev,
        hashesProcessed: processedItems.length,
        currentFilename: undefined,
      }));

      setScanStatus('completed');
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    } catch (err: unknown) {
      console.error('Scan error:', err);
      const msg = err instanceof Error ? err.message : 'An error occurred during scan.';
      setScanError(msg);
      setScanStatus('error');
    }
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
  const handleLocalPhotosLoaded = (loadedItems: PhotoMediaItem[]) => {
    setPhotos((prev) => [...loadedItems, ...prev]);
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
              onStartScan={handleStartScan}
              onPauseScan={() => setScanStatus('paused')}
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
            />

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
                      onClick={handleStartScan}
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

                {/* Render Duplicate Groups */}
                {displayedGroups.map((group) => (
                  <DuplicateGroupCard
                    key={group.groupId}
                    group={group}
                    onCompare={(groupItems) => setComparingItems(groupItems)}
                    onToggleSelectItem={handleToggleSelectItem}
                    onSelectAllExceptOne={handleSelectAllExceptOne}
                  />
                ))}

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
          groups={shaGroups}
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
