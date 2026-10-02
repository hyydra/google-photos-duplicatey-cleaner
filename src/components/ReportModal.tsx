import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, FileCode, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { DuplicateGroup, PhotoMediaItem } from '../types';
import { formatBytes } from '../services/hasher';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: DuplicateGroup[];
  allPhotos: PhotoMediaItem[];
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  groups,
  allPhotos,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const duplicatePhotos = allPhotos.filter((p) =>
    groups.some((g) => g.items.some((i) => i.id === p.id))
  );

  const markedForAction = allPhotos.filter((p) => p.selectedForAction);

  const handleExportCsv = () => {
    const headers = [
      'Duplicate Group ID',
      'Match Type',
      'Filename',
      'SHA-256 Checksum',
      'Pixel Width',
      'Pixel Height',
      'Resolution (MP)',
      'Aspect Ratio',
      'File Size (Bytes)',
      'Camera Make',
      'Camera Model',
      'Capture Date (EXIF)',
      'Google Photos URL',
      'Marked as Duplicate',
    ];

    const rows = groups.flatMap((group) =>
      group.items.map((item) => [
        group.groupId,
        group.type,
        `"${item.filename.replace(/"/g, '""')}"`,
        item.sha256 || '',
        item.width,
        item.height,
        item.megapixels,
        `"${item.aspectRatio}"`,
        item.fileSizeBytes || 0,
        `"${item.exif.cameraMake || ''}"`,
        `"${item.exif.cameraModel || ''}"`,
        `"${item.exif.dateTimeOriginal || item.creationTime}"`,
        `"${item.productUrl || ''}"`,
        item.selectedForAction ? 'YES' : 'NO',
      ])
    );

    const csvString = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `photosha_duplicates_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess('CSV Export generated successfully!');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handleExportJson = () => {
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      summary: {
        totalDuplicateGroups: groups.length,
        totalDuplicatePhotos: duplicatePhotos.length,
        markedForAction: markedForAction.length,
      },
      duplicateClusters: groups.map((g) => ({
        groupId: g.groupId,
        matchType: g.type,
        hashKey: g.hashKey,
        potentialSavingsBytes: g.savingsBytes,
        items: g.items.map((it) => ({
          id: it.id,
          filename: it.filename,
          sha256: it.sha256,
          sha1: it.sha1,
          width: it.width,
          height: it.height,
          megapixels: it.megapixels,
          aspectRatio: it.aspectRatio,
          fileSizeBytes: it.fileSizeBytes,
          exif: it.exif,
          creationTime: it.creationTime,
          productUrl: it.productUrl,
          markedAsDuplicate: it.selectedForAction,
        })),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `photosha_duplicates_report_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess('JSON Report generated successfully!');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Duplicate Analysis Report</h3>
            <p className="text-xs text-slate-500">
              Export cryptographic hashes, exact pixel dimensions, and EXIF parameters.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Duplicate Clusters</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{groups.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Duplicate Copies</span>
              <p className="text-xl font-bold text-amber-600 mt-0.5">{duplicatePhotos.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Marked for Action</span>
              <p className="text-xl font-bold text-red-600 mt-0.5">{markedForAction.length}</p>
            </div>
          </div>

          {/* Export formats */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Download Audit Data
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleExportCsv}
                className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-left transition-all flex items-start gap-3 cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Spreadsheet (CSV)</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ideal for Excel, Google Sheets, and sorting by pixel dimensions or camera.
                  </p>
                </div>
              </button>

              <button
                onClick={handleExportJson}
                className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-left transition-all flex items-start gap-3 cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700 group-hover:scale-105 transition-transform">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Developer JSON</div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Full structured object tree with all EXIF tags and hash keys.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {downloadSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          {/* Google Photos API Note */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Google Photos Direct Access:</span> Each item in the report includes its direct Google Photos link (`productUrl`), allowing you to review or delete duplicate items directly on Google Photos with 1-click.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
