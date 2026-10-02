import React, { useState, useRef } from 'react';
import { UploadCloud, FileImage, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { PhotoMediaItem, ExifDetails } from '../types';
import {
  computeSha256,
  computeSha1,
  extractExifFromBuffer,
  getExactPixelDimensions,
  computeAspectRatio,
  formatBytes,
} from '../services/hasher';

interface LocalPhotoDropzoneProps {
  onPhotosLoaded: (items: PhotoMediaItem[]) => void;
}

export const LocalPhotoDropzone: React.FC<LocalPhotoDropzoneProps> = ({ onPhotosLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number; filename: string }>({
    current: 0,
    total: 0,
    filename: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|tiff|raw)$/i.test(file.name)
    );

    if (imageFiles.length === 0) {
      alert('Please select valid image files.');
      return;
    }

    setIsProcessing(true);
    const loadedItems: PhotoMediaItem[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      setProcessingProgress({
        current: i + 1,
        total: imageFiles.length,
        filename: file.name,
      });

      try {
        const buffer = await file.arrayBuffer();
        const sha256 = await computeSha256(buffer);
        const sha1 = await computeSha1(buffer);
        const exif = extractExifFromBuffer(buffer);

        const blobUrl = URL.createObjectURL(file);
        const dimensions = await getExactPixelDimensions(file);

        const item: PhotoMediaItem = {
          id: `local-${file.name}-${file.size}-${Date.now()}-${i}`,
          filename: file.name,
          baseUrl: blobUrl,
          blobUrl,
          mimeType: file.type || 'image/jpeg',
          creationTime: exif.dateTimeOriginal || new Date(file.lastModified).toISOString(),
          fileSizeBytes: file.size,
          width: dimensions.width,
          height: dimensions.height,
          megapixels: dimensions.megapixels,
          aspectRatio: dimensions.aspectRatio,
          sha256,
          sha1,
          hashStatus: 'completed',
          exif: {
            ...exif,
            dateTimeOriginal: exif.dateTimeOriginal || new Date(file.lastModified).toISOString(),
          },
          source: 'local',
        };

        loadedItems.push(item);
      } catch (err) {
        console.error('Failed to parse local image:', file.name, err);
      }
    }

    setIsProcessing(false);
    onPhotosLoaded(loadedItems);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Local Image & Google Takeout Scanner</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Drop local photos or Google Takeout archive folders to compute exact SHA-256 hashes, verify pixel dimensions, and compare EXIF locally.
          </p>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
          Client-Side Web Crypto
        </span>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
        }`}
      >
        <div className="max-w-md mx-auto flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-100/70 text-blue-600 flex items-center justify-center mb-4 shadow-xs">
            <UploadCloud className="w-7 h-7" />
          </div>

          <p className="text-sm font-semibold text-slate-800 mb-1">
            Drag and drop photos or whole folders here
          </p>
          <p className="text-xs text-slate-500 mb-5">
            Supports JPEG, PNG, TIFF, WebP, HEIC. Hashes are computed in your browser using native hardware acceleration.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Select Image Files
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={isProcessing}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Select Folder (Takeout)
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.heic,.tiff"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                processFiles(e.target.files);
              }
              e.target.value = '';
            }}
          />
          {/* @ts-ignore folder select attribute */}
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory="true"
            // @ts-ignore
            directory="true"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                processFiles(e.target.files);
              }
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {isProcessing && (
        <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
          <div className="flex items-center justify-between text-xs text-blue-900 font-medium mb-1">
            <span>
              Hashing & Extracting EXIF ({processingProgress.current} / {processingProgress.total})
            </span>
            <span>
              {processingProgress.total > 0
                ? Math.round((processingProgress.current / processingProgress.total) * 100)
                : 0}%
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-200"
              style={{
                width: `${processingProgress.total > 0 ? (processingProgress.current / processingProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-blue-700 mt-1.5 font-mono truncate">
            {processingProgress.filename}
          </p>
        </div>
      )}
    </div>
  );
};
