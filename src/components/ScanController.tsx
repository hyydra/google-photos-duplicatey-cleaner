import React from 'react';
import {
  Play,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  HardDrive,
  Copy,
  Hash,
  Maximize2
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
}

export const ScanController: React.FC<ScanControllerProps> = ({
  status,
  progress,
  onStartScan,
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
            {totalPhotosCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {status === 'computing-hashes'
              ? `Hashing: ${progress.hashesProcessed} / ${progress.fetchedItems}`
              : 'Complete pixel & hash inspect'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <Copy className="w-4 h-4 text-amber-600" />
            <span>Duplicate Photos</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {duplicateCount}
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
            <Maximize2 className="w-4 h-4 text-purple-600" />
            <span>Deduplication Algorithm</span>
          </div>
          <div className="text-xl font-bold text-purple-700 flex items-center gap-1.5">
            <span>{hashAlgorithm}</span>
            <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-md font-mono">
              + EXIF
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Bit-for-bit cryptographic match
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
                  ? 'Retrieving media items from Google Photos...'
                  : `Downloading & computing ${hashAlgorithm} checksums...`}
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
              Processing: {progress.currentFilename}
            </p>
          )}
        </div>
      )}

      {/* Action Controls & Settings Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-2 border-t border-slate-100">
        {/* Left: Scan Trigger Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isLoggedIn ? (
            <button
              onClick={onStartScan}
              disabled={isScanning}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isScanning ? 'Scanning Library...' : 'Scan Google Photos'}</span>
            </button>
          ) : (
            <button
              onClick={onTriggerSignIn}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Sign in to Scan Google Photos</span>
            </button>
          )}

          <button
            onClick={onLoadSampleData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-medium text-sm transition-all cursor-pointer"
            title="Load high-resolution test photos with duplicate SHA hashes and EXIF metadata"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Load Sample Test Photos</span>
          </button>

          {totalPhotosCount > 0 && (
            <button
              onClick={onResetScan}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-sm transition-all cursor-pointer"
              title="Reset all scanned items and clusters"
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
              <span>Export Duplicate Report</span>
            </button>
          )}
        </div>

        {/* Right: Fine-tuning Settings & Filters */}
        <div className="flex flex-wrap items-center gap-3">
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
              Exact SHA-256
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

          {/* Batch Size Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span>Batch:</span>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="bg-transparent border-none text-xs font-medium text-slate-800 focus:outline-hidden cursor-pointer"
            >
              <option value={25}>25 photos</option>
              <option value={50}>50 photos</option>
              <option value={100}>100 photos</option>
            </select>
          </div>

          {/* Download Quality Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useFullResDownload}
              onChange={(e) => setUseFullResDownload(e.target.checked)}
              className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span title="Download original full-resolution byte-for-byte stream from Google Photos for exact cryptographic SHA match">
              Full-res bytes (=d)
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
