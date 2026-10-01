import React from 'react';
import { AlertOctagon, Trash2, X, ExternalLink } from 'lucide-react';
import { PhotoMediaItem } from '../types';
import { formatBytes } from '../services/hasher';

interface DestructiveActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedItems: PhotoMediaItem[];
}

export const DestructiveActionDialog: React.FC<DestructiveActionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedItems,
}) => {
  if (!isOpen) return null;

  const totalBytes = selectedItems.reduce((acc, item) => acc + (item.fileSizeBytes || 0), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="p-6">
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
            <AlertOctagon className="w-6 h-6" />
          </div>

          <h3 className="text-lg font-bold text-slate-900">
            Confirm Duplicate Cleanup Action
          </h3>

          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            You are about to prepare <span className="font-semibold text-slate-900">{selectedItems.length} duplicate photos</span> ({formatBytes(totalBytes)}) for removal.
          </p>

          {/* List of affected items preview */}
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto text-xs divide-y divide-slate-200">
            {selectedItems.map((item) => (
              <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                <div className="truncate font-medium text-slate-800">
                  {item.filename}
                </div>
                <div className="font-mono text-slate-500 shrink-0">
                  {item.width}×{item.height} • {formatBytes(item.fileSizeBytes)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
            <strong>Important Safety Notice:</strong> Google Photos Library API policies require photos to be trashed directly in your Google Photos app or web interface. PhotoSHA will open each duplicate item directly in Google Photos or export a batch cleanup checklist so you retain full control over permanent deletions.
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel (No Changes)
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Trash2 className="w-4 h-4" />
            <span>Proceed with Cleanup</span>
          </button>
        </div>
      </div>
    </div>
  );
};
