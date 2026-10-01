export interface ExifDetails {
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  dateTimeOriginal?: string;
  iso?: number | string;
  aperture?: number | string;
  focalLength?: number | string;
  exposureTime?: string;
  flash?: string;
  whiteBalance?: string;
  software?: string;
  colorSpace?: string;
  gps?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
  };
  rawTags?: Record<string, string>;
}

export interface PhotoMediaItem {
  id: string;
  filename: string;
  productUrl?: string;
  baseUrl: string;
  mimeType: string;
  creationTime: string;
  fileSizeBytes?: number;
  // Exact pixel dimensions
  width: number;
  height: number;
  megapixels: number;
  aspectRatio: string;
  // Cryptographic Hashes
  sha256?: string;
  sha1?: string;
  md5?: string;
  hashStatus: 'pending' | 'computing' | 'completed' | 'error';
  hashError?: string;
  // Deep EXIF
  exif: ExifDetails;
  source: 'google-photos' | 'google-drive' | 'local' | 'sample';
  blobUrl?: string;
  selectedForAction?: boolean;
}

export interface DuplicateGroup {
  groupId: string;
  type: 'exact-sha' | 'dimension-and-exif' | 'similar-visual';
  hashKey: string;
  items: PhotoMediaItem[];
  savingsBytes: number;
  allDimensionsMatch: boolean;
  allExifMatch: boolean;
  differencesSummary: string[];
}

export type ScanStatus = 'idle' | 'fetching-list' | 'computing-hashes' | 'paused' | 'completed' | 'error';

export interface ScanProgress {
  totalFound: number;
  fetchedItems: number;
  hashesProcessed: number;
  currentFilename?: string;
  currentBytes?: number;
  duplicateGroupsFound: number;
}
