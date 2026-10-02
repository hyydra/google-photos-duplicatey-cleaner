import React, { useState } from 'react';
import {
  X,
  Check,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  Copy,
  Camera,
  MapPin,
  Calendar,
  CheckCircle2,
  Sliders,
  Sparkles
} from 'lucide-react';
import { PhotoMediaItem } from '../types';
import { comparePhotoDetails, formatBytes, getPhotoDisplayUrl } from '../services/hasher';

interface ComparisonModalProps {
  items: PhotoMediaItem[];
  isOpen: boolean;
  onClose: () => void;
  onToggleSelectItem: (itemId: string) => void;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({
  items,
  isOpen,
  onClose,
  onToggleSelectItem,
}) => {
  const [indexA, setIndexA] = useState(0);
  const [indexB, setIndexB] = useState(items.length > 1 ? 1 : 0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeTab, setActiveTab] = useState<'matrix' | 'visual' | 'raw'>('matrix');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen || items.length === 0) return null;

  const photoA = items[indexA] || items[0];
  const photoB = items[indexB] || items[items.length - 1];

  const diffResult = comparePhotoDetails(photoA, photoB);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const areDimensionsIdentical =
    photoA.width > 0 &&
    photoB.width > 0 &&
    photoA.width === photoB.width &&
    photoA.height === photoB.height;

  const areShaIdentical =
    !!photoA.sha256 && !!photoB.sha256 && photoA.sha256 === photoB.sha256;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Side-by-Side Deep Diff</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                Exact Pixel & EXIF Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare bit-for-bit cryptographic SHA hashes, pixel dimensions, and shooting metadata.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View switcher tabs */}
            <div className="bg-slate-200/80 p-0.5 rounded-lg flex items-center text-xs">
              <button
                onClick={() => setActiveTab('matrix')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeTab === 'matrix' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                EXIF & Pixel Matrix
              </button>
              <button
                onClick={() => setActiveTab('visual')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeTab === 'visual' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Visual Zoom (Loupe)
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pair Selector if > 2 items */}
        {items.length > 2 && (
          <div className="px-6 py-2 bg-blue-50/50 border-b border-blue-100 flex flex-wrap items-center justify-between text-xs text-slate-700">
            <span className="font-medium text-blue-900">Group contains {items.length} items. Select pair to compare:</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-slate-800">Photo A:</span>
                <select
                  value={indexA}
                  onChange={(e) => setIndexA(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-md px-2 py-0.5 font-medium"
                >
                  {items.map((it, i) => (
                    <option key={it.id} value={i} disabled={i === indexB}>
                      #{i + 1} - {it.filename}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-slate-400">vs</span>

              <div className="flex items-center gap-1">
                <span className="font-semibold text-slate-800">Photo B:</span>
                <select
                  value={indexB}
                  onChange={(e) => setIndexB(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-md px-2 py-0.5 font-medium"
                >
                  {items.map((it, i) => (
                    <option key={it.id} value={i} disabled={i === indexA}>
                      #{i + 1} - {it.filename}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Top Summary Banner: SHA & Dimension Match verdict */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Dimension Match Status */}
          <div
            className={`p-3 rounded-xl border flex items-start gap-3 ${
              areDimensionsIdentical
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
            }`}
          >
            {areDimensionsIdentical ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold">
                {areDimensionsIdentical
                  ? 'Exact 1:1 Pixel Dimensions Match'
                  : 'Pixel Dimension Discrepancy'}
              </div>
              <p className="text-[11px] opacity-90 mt-0.5">
                {areDimensionsIdentical
                  ? `Both photos share identical resolution: ${photoA.width} × ${photoA.height} px (${photoA.megapixels} MP)`
                  : `Photo A is ${photoA.width}×${photoA.height} (${photoA.megapixels}MP) vs Photo B ${photoB.width}×${photoB.height} (${photoB.megapixels}MP)`}
              </p>
            </div>
          </div>

          {/* Cryptographic SHA Match Status */}
          <div
            className={`p-3 rounded-xl border flex items-start gap-3 ${
              areShaIdentical
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-blue-50/70 border-blue-200 text-blue-900'
            }`}
          >
            {areShaIdentical ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold">
                {areShaIdentical
                  ? 'Cryptographic SHA-256 Identical'
                  : 'Distinct Checksums (Different Compression/Metadata)'}
              </div>
              <p className="text-[11px] opacity-90 mt-0.5 font-mono truncate max-w-sm">
                {areShaIdentical
                  ? `SHA: ${photoA.sha256?.substring(0, 24)}...`
                  : `Photo A & B have different binary hashes`}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'visual' ? (
            /* Visual Zoom & Inspector */
            <div className="space-y-4">
              {/* Zoom Controls */}
              <div className="flex items-center justify-between bg-slate-100 p-2.5 rounded-xl text-xs">
                <span className="font-medium text-slate-700">Pixel Zoom Level:</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))}
                    className="p-1 rounded-md bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer"
                  >
                    <ZoomOut className="w-4 h-4 text-slate-700" />
                  </button>
                  <span className="font-mono font-semibold w-12 text-center text-slate-900">
                    {zoomLevel}x
                  </span>
                  <button
                    onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.5))}
                    className="p-1 rounded-md bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer"
                  >
                    <ZoomIn className="w-4 h-4 text-slate-700" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="px-2 py-1 rounded-md bg-white border border-slate-300 text-[11px] text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Reset 1x
                  </button>
                </div>
              </div>

              {/* Side-by-side Visual Viewport */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Photo A Viewport */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-950 flex flex-col">
                  <div className="p-2.5 bg-slate-900 border-b border-slate-800 text-xs text-white flex items-center justify-between">
                    <span className="font-medium truncate max-w-[200px]">Photo A: {photoA.filename}</span>
                    <span className="font-mono text-emerald-400 text-[11px]">
                      {photoA.width} × {photoA.height} px
                    </span>
                  </div>
                  <div className="relative aspect-4/3 overflow-hidden flex items-center justify-center bg-black/40">
                    <img
                      src={getPhotoDisplayUrl(photoA, 'w1600-h1600')}
                      alt={photoA.filename}
                      style={{ transform: `scale(${zoomLevel})` }}
                      className="max-w-full max-h-full object-contain transition-transform duration-200"
                    />
                  </div>
                </div>

                {/* Photo B Viewport */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-950 flex flex-col">
                  <div className="p-2.5 bg-slate-900 border-b border-slate-800 text-xs text-white flex items-center justify-between">
                    <span className="font-medium truncate max-w-[200px]">Photo B: {photoB.filename}</span>
                    <span className="font-mono text-emerald-400 text-[11px]">
                      {photoB.width} × {photoB.height} px
                    </span>
                  </div>
                  <div className="relative aspect-4/3 overflow-hidden flex items-center justify-center bg-black/40">
                    <img
                      src={getPhotoDisplayUrl(photoB, 'w1600-h1600')}
                      alt={photoB.filename}
                      style={{ transform: `scale(${zoomLevel})` }}
                      className="max-w-full max-h-full object-contain transition-transform duration-200"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* EXIF & Pixel Matrix Tab */
            <div className="space-y-6">
              {/* Photo Preview Mini Headers */}
              <div className="grid grid-cols-2 gap-4">
                {/* Photo A Header Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={getPhotoDisplayUrl(photoA, 'w120-h120')}
                      alt={photoA.filename}
                      className="w-14 h-14 rounded-lg object-cover border border-slate-300 shadow-xs"
                    />
                    <div>
                      <div className="font-bold text-slate-900 text-sm truncate max-w-[180px] sm:max-w-xs">
                        {photoA.filename}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {photoA.width} × {photoA.height} px • {photoA.megapixels} MP
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {formatBytes(photoA.fileSizeBytes)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {photoA.productUrl && (
                      <a
                        href={photoA.productUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <span>Open Photos</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      onClick={() => onToggleSelectItem(photoA.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                        photoA.selectedForAction
                          ? 'bg-red-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {photoA.selectedForAction ? 'Marked as Duplicate' : 'Mark for Action'}
                    </button>
                  </div>
                </div>

                {/* Photo B Header Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={getPhotoDisplayUrl(photoB, 'w120-h120')}
                      alt={photoB.filename}
                      className="w-14 h-14 rounded-lg object-cover border border-slate-300 shadow-xs"
                    />
                    <div>
                      <div className="font-bold text-slate-900 text-sm truncate max-w-[180px] sm:max-w-xs">
                        {photoB.filename}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {photoB.width} × {photoB.height} px • {photoB.megapixels} MP
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {formatBytes(photoB.fileSizeBytes)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {photoB.productUrl && (
                      <a
                        href={photoB.productUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <span>Open Photos</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      onClick={() => onToggleSelectItem(photoB.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                        photoB.selectedForAction
                          ? 'bg-red-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {photoB.selectedForAction ? 'Marked as Duplicate' : 'Mark for Action'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Exact SHA-256 Full String Row */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-900 text-white">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                  <span>Cryptographic Checksum Verification</span>
                  <span className="font-mono text-blue-400">Web Crypto SHA-256</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Photo A Checksum:</span>
                      <button
                        onClick={() => handleCopy(photoA.sha256 || '', 'shaA')}
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                      >
                        {copiedKey === 'shaA' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <p className="font-mono text-xs break-all text-emerald-400 select-all">
                      {photoA.sha256 || 'Pending computation...'}
                    </p>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Photo B Checksum:</span>
                      <button
                        onClick={() => handleCopy(photoB.sha256 || '', 'shaB')}
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                      >
                        {copiedKey === 'shaB' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <p className="font-mono text-xs break-all text-emerald-400 select-all">
                      {photoB.sha256 || 'Pending computation...'}
                    </p>
                  </div>
                </div>
              </div>

              {/* EXIF Comparison Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      EXIF Metadata & Shooting Parameters Diff
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {diffResult.differences.filter((d) => d.identical).length} Identical /{' '}
                    {diffResult.differences.filter((d) => !d.identical).length} Differences
                  </span>
                </div>

                <div className="divide-y divide-slate-200 text-xs">
                  {diffResult.differences.map((diff, idx) => (
                    <div
                      key={idx}
                      className={`grid grid-cols-12 py-2.5 px-4 items-center transition-colors ${
                        diff.identical
                          ? 'bg-white hover:bg-slate-50/60'
                          : 'bg-amber-50/40 hover:bg-amber-50/70'
                      }`}
                    >
                      <div className="col-span-3 font-medium text-slate-700 flex items-center gap-1.5">
                        <span>{diff.field}</span>
                      </div>

                      <div className="col-span-4 font-mono text-slate-800 break-all pr-2">
                        {diff.valA}
                      </div>

                      <div className="col-span-1 flex justify-center">
                        {diff.identical ? (
                          <span
                            className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs"
                            title="Values match exactly"
                          >
                            ✓
                          </span>
                        ) : (
                          <span
                            className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs"
                            title="Different values"
                          >
                            ≠
                          </span>
                        )}
                      </div>

                      <div className="col-span-4 font-mono text-slate-800 break-all pl-2">
                        {diff.valB}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* GPS Location check if present */}
              {(photoA.exif.gps || photoB.exif.gps) && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-2">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span>GPS Coordinates (EXIF Geolocation)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono text-slate-600">
                    <div>
                      Photo A:{' '}
                      {photoA.exif.gps?.latitude
                        ? `${photoA.exif.gps.latitude.toFixed(5)}, ${photoA.exif.gps.longitude?.toFixed(5)}`
                        : 'No GPS data'}
                    </div>
                    <div>
                      Photo B:{' '}
                      {photoB.exif.gps?.latitude
                        ? `${photoB.exif.gps.latitude.toFixed(5)}, ${photoB.exif.gps.longitude?.toFixed(5)}`
                        : 'No GPS data'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Tip: You can mark unwanted duplicate copies for deletion or export a list.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            Close Diff Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
