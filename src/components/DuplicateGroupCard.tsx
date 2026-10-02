import React, { useState } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  Eye,
  Sliders,
  CheckSquare,
  Square,
  Camera,
  Calendar,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { DuplicateGroup, PhotoMediaItem } from '../types';
import { formatBytes, getPhotoDisplayUrl } from '../services/hasher';

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  onCompare: (items: PhotoMediaItem[]) => void;
  onToggleSelectItem: (itemId: string) => void;
  onSelectAllExceptOne: (groupId: string, strategy: 'keep-highest-res' | 'keep-oldest' | 'keep-newest') => void;
}

export const DuplicateGroupCard: React.FC<DuplicateGroupCardProps> = ({
  group,
  onCompare,
  onToggleSelectItem,
  onSelectAllExceptOne,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(group.hashKey);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const isExactSha = group.type === 'exact-sha';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow mb-6">
      {/* Group Header */}
      <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                isExactSha
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {isExactSha ? '100% Cryptographic Match' : 'EXIF & Dimension Match'}
            </span>

            <span className="text-xs font-medium text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              {group.items.length} Duplicate Copies
            </span>

            {group.savingsBytes > 0 && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                Save ~{formatBytes(group.savingsBytes)}
              </span>
            )}
          </div>

          {/* Cryptographic Hash line */}
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span className="text-slate-400 font-sans">
              {isExactSha ? 'SHA-256:' : 'Cluster Key:'}
            </span>
            <span className="truncate max-w-[240px] sm:max-w-[420px] bg-white px-2 py-0.5 rounded-sm border border-slate-200 select-all">
              {group.hashKey}
            </span>
            <button
              onClick={handleCopyHash}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/50 transition-colors"
              title="Copy hash to clipboard"
            >
              {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Group Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Smart Selection presets */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => onSelectAllExceptOne(group.groupId, 'keep-highest-res')}
              className="px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium flex items-center gap-1"
              title="Keep the highest megapixel photo, select all lower-res duplicates"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Keep Best Res</span>
            </button>
            <button
              onClick={() => onSelectAllExceptOne(group.groupId, 'keep-oldest')}
              className="px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
              title="Keep the earliest uploaded photo, mark newer duplicates"
            >
              Keep Oldest
            </button>
          </div>

          <button
            onClick={() => onCompare(group.items)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-xs border border-blue-200 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Deep Diff (Pixel & EXIF)</span>
          </button>
        </div>
      </div>

      {/* Difference summary banners if any */}
      {group.differencesSummary && group.differencesSummary.length > 0 && (
        <div className="px-5 py-2 bg-slate-50/40 border-b border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {group.differencesSummary.map((diff, i) => (
              <span key={i}>• {diff}</span>
            ))}
          </div>
        </div>
      )}

      {/* Photos Grid in Cluster */}
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {group.items.map((item, idx) => {
          const isSelected = !!item.selectedForAction;
          return (
            <div
              key={item.id || idx}
              className={`group relative rounded-xl border transition-all overflow-hidden flex flex-col bg-white ${
                isSelected
                  ? 'border-red-400 bg-red-50/20 ring-2 ring-red-400/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Image Preview with overlay badges */}
              <div className="relative aspect-4/3 bg-slate-100 overflow-hidden cursor-pointer" onClick={() => onCompare(group.items)}>
                <img
                  src={getPhotoDisplayUrl(item, 'w600-h600')}
                  alt={item.filename}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Top Overlay: Checkbox to mark duplicate */}
                <div
                  className="absolute top-2 left-2 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelectItem(item.id);
                  }}
                >
                  <button
                    className={`w-6 h-6 rounded-md flex items-center justify-center shadow-md transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-red-600 text-white'
                        : 'bg-white/90 text-slate-600 hover:bg-white border border-slate-300'
                    }`}
                    title={isSelected ? 'Marked as duplicate' : 'Mark this duplicate'}
                  >
                    {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </div>

                {/* Top Right: Exact Dimensions Pill */}
                <div className="absolute top-2 right-2 z-10">
                  <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-[11px] font-mono font-medium text-white shadow-xs">
                    {item.width > 0 ? `${item.width} × ${item.height}` : 'Dimensions pending'}
                  </span>
                </div>

                {/* Bottom Overlay: Megapixels & Aspect Ratio */}
                <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
                  <span className="px-1.5 py-0.5 rounded-sm bg-black/60 backdrop-blur-xs text-[10px] font-semibold text-amber-300">
                    {item.megapixels > 0 ? `${item.megapixels} MP` : ''}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-sm bg-black/60 backdrop-blur-xs text-[10px] text-slate-200">
                    {item.aspectRatio}
                  </span>
                </div>
              </div>

              {/* Photo Details & EXIF Card */}
              <div className="p-3 flex-1 flex flex-col justify-between text-xs">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-slate-900 truncate" title={item.filename}>
                      {item.filename}
                    </span>
                    {item.productUrl && (
                      <a
                        href={item.productUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-blue-600 shrink-0 p-0.5"
                        title="View photo on Google Photos"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {/* Size & Date */}
                  <div className="flex items-center justify-between text-slate-500 text-[11px] mb-2">
                    <span>{formatBytes(item.fileSizeBytes)}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {new Date(item.creationTime).toLocaleDateString()}
                    </span>
                  </div>

                  {/* EXIF Mini Summary */}
                  <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-700 truncate" title={item.exif.cameraModel || 'No camera model'}>
                      <Camera className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {item.exif.cameraMake ? `${item.exif.cameraMake} ` : ''}
                        {item.exif.cameraModel || 'Camera EXIF n/a'}
                      </span>
                    </div>

                    {(item.exif.aperture || item.exif.exposureTime || item.exif.iso) && (
                      <div className="flex items-center gap-2 text-slate-500 text-[10px] font-mono">
                        {item.exif.aperture && <span>{item.exif.aperture}</span>}
                        {item.exif.exposureTime && <span>{item.exif.exposureTime}</span>}
                        {item.exif.iso && <span>ISO {item.exif.iso}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom status badge */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-sm ${
                      isSelected
                        ? 'bg-red-100 text-red-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isSelected ? 'Marked for Action' : 'Preserved Copy'}
                  </span>

                  <button
                    onClick={() => onCompare(group.items)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Inspect
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
