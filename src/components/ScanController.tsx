import React from 'react';
import {
  Play,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  HardDrive,
  Copy,
  Hash,
  Maximize2,
  Search,
  PlusCircle,
  Pause,
  Zap
} from 'lucide-react';
import { ScanProgress, ScanStatus } from '../types';
import { formatBytes } from '../services/hasher';

interface ScanControllerProps {
  status: ScanStatus;
  progress: ScanProgress;
  onStartScan: () => void;
  onPauseScan: () => void;
  onResetScan: () => void;
  onLoadSampleData: () => void;
  isLoggedIn: boolean;
  onTriggerSignIn: () => void;
  batchSize: number;
  setBatchSize: (size: number) => void;
  hashAlgorithm: 'SHA-256' | 'SHA-1';
  setHashAlgorithm: (algo: 'SHA-256' | 'SHA-1') => void;
  useFullResDownload: boolean;
  setUseFullResDownload: (full: boolean) => void;
  filterType: 'all' | 'exact-sha' | 'dimension-and-exif';
  setFilterType: (filter: 'all' | 'exact-sha' | 'dimension-and-exif') => void;
  totalSavingsBytes: number;
  duplicateCount: number;
  totalPhotosCount: number;
  onOpenReport: () => void;
  hasNextPage?: boolean;
  onScanNextBatch?: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const ScanController: React.FC<ScanControllerProps> = ({
  status,
  progress,
  onStartScan,
  onPauseScan,
  onResetScan,
  onLoadSampleData,
  isLoggedIn,
  onTriggerSignIn,
  batchSize,
  setBatchSize,
  hashAlgorithm,
  setHashAlgorithm,
  useFullResDownload,
  setUseFullResDownload,
  filterType,
  setFilterType,
  totalSavingsBytes,
  duplicateCount,
  totalPhotosCount,
  onOpenReport,
  hasNextPage,
  onScanNextBatch,
  searchQuery,
  setSearchQuery,
}) => {
  const isScanning = status === 'fetching-list' || status === 'computing-hashes';
  const progressPercent =
    progress.fetchedItems > 0
      ? Math.min(100, Math.round((progress.hashesProcessed / progress.fetchedItems) * 100))
      : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs mb-8">
      {/* Top Banner Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <Hash className="w-4 h-4 text-blue-600" />
            <span>Photos Analyzed</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {totalPhotosCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {status === 'computing-hashes'
              ? `Hashing: ${progress.hashesProcessed} / ${progress.fetchedItems}`
              : 'Stored in IndexedDB cache'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <Copy className="w-4 h-4 text-amber-600" />
            <span>Duplicate Photos</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {duplicateCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Across {progress.duplicateGroupsFound} duplicate clusters
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <HardDrive className="w-4 h-4 text-emerald-600" />
            <span>Reclaimable Space</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {formatBytes(totalSavingsBytes)}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Redundant duplicate storage
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <Zap className="w-4 h-4 text-purple-600" />
            <span>Scan Engine</span>
          </div>
          <div className="text-xl font-bold text-purple-700 flex items-center gap-1.5">
            <span>5x Concurrency</span>
            <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-md font-mono">
              Fast
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Parallel SHA-256 + native checksums
          </p>
        </div>
      </div>

      {/* Live Scan Progress Bar (Visible while scanning or paused) */}
      {(isScanning || status === 'paused') && (
        <div className="mb-6 p-4 rounded-xl bg-blue-50/60 border border-blue-100">
          <div className="flex items-center justify-between text-xs text-blue-900 font-medium mb-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              <span>
                {status === 'fetching-list'
                  ? `Retrieving media catalog from library (${progress.fetchedItems} items found so far)...`
                  : `Computing ${hashAlgorithm} checksums & comparing pixel dimensions (${progress.hashesProcessed} / ${progress.fetchedItems})...`}
              </span>
            </div>
            <span className="font-semibold text-blue-700">{progressPercent}%</span>
          </div>
          <div className="w-full bg-blue-200/60 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progress.currentFilename && (
            <p className="text-[11px] text-blue-600/80 mt-2 truncate font-mono">
              Current: {progress.currentFilename}
            </p>
          )}
        </div>
      )}

      {/* Action Controls & Settings Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-2 border-t border-slate-100">
        {/* Left: Scan Trigger Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onStartScan}
                disabled={isScanning}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>
                  {isScanning
                    ? `Scanning (${progress.fetchedItems})...`
                    : batchSize === 0
                    ? 'Scan All Photos (Full Library)'
                    : `Scan ${batchSize.toLocaleString()} Photos`}
                </span>
              </button>

              {isScanning && (
                <button
                  onClick={onPauseScan}
                  className="px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-medium text-xs flex items-center gap-1.5 cursor-pointer"
                  title="Pause current batch scan"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              )}

              {hasNextPage && onScanNextBatch && !isScanning && (
                <button
                  onClick={onScanNextBatch}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-sm border border-indigo-200 transition-all cursor-pointer"
                  title="Scan the next batch of photos from where you left off"
                >
                  <PlusCircle className="w-4 h-4 text-indigo-600" />
                  <span>Scan Next Batch</span>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onTriggerSignIn}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Sign in to Scan Photos</span>
            </button>
          )}

          <button
            onClick={onLoadSampleData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-medium text-sm transition-all cursor-pointer"
            title="Load high-resolution test photos with duplicate SHA hashes and EXIF metadata"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Load Demo Library</span>
          </button>

          {totalPhotosCount > 0 && (
            <button
              onClick={onResetScan}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-sm transition-all cursor-pointer"
              title="Reset current view"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          {duplicateCount > 0 && (
            <button
              onClick={onOpenReport}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-sm font-medium transition-all cursor-pointer"
            >
              <span>Export Report</span>
            </button>
          )}
        </div>

        {/* Right: Fine-tuning Settings, Batch Size & Search */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input for Large Libraries */}
          {totalPhotosCount > 0 && (
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search duplicates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-400 focus:bg-white w-36 sm:w-44"
              />
            </div>
          )}

          {/* Batch Size Selector with Large Quantities */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="font-medium text-slate-700">Scan Limit:</span>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              disabled={isScanning}
              className="bg-transparent border-none text-xs font-semibold text-blue-700 focus:outline-hidden cursor-pointer disabled:opacity-50"
            >
              <option value={50}>50 photos</option>
              <option value={100}>100 photos</option>
              <option value={250}>250 photos</option>
              <option value={500}>500 photos</option>
              <option value={1000}>1,000 photos</option>
              <option value={2500}>2,500 photos</option>
              <option value={5000}>5,000 photos</option>
              <option value={0}>All (Entire Library)</option>
            </select>
          </div>

          {/* Duplicate Category Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600'
              }`}
            >
              All Matches
            </button>
            <button
              onClick={() => setFilterType('exact-sha')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterType === 'exact-sha' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600'
              }`}
            >
              Exact SHA
            </button>
            <button
              onClick={() => setFilterType('dimension-and-exif')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterType === 'dimension-and-exif' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600'
              }`}
            >
              EXIF & Pixel
            </button>
          </div>

          {/* SHA Algorithm Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={hashAlgorithm}
              onChange={(e) => setHashAlgorithm(e.target.value as 'SHA-256' | 'SHA-1')}
              className="bg-transparent border-none text-xs font-medium text-slate-800 focus:outline-hidden cursor-pointer"
            >
              <option value="SHA-256">SHA-256 (Standard)</option>
              <option value="SHA-1">SHA-1 (Legacy)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
