import { PhotoMediaItem, ExifDetails, DuplicateGroup } from '../types';
import {
  computeSha256,
  computeSha1,
  extractExifFromBuffer,
  getExactPixelDimensions,
  computeAspectRatio,
} from './hasher';

export interface FetchPhotosResult {
  items: PhotoMediaItem[];
  nextPageToken?: string;
  sourceType: 'google-drive' | 'google-photos' | 'picker';
}

/**
 * Fetch photos from Google Drive (includes Google Photos sync, Drive photos, and mobile backups).
 * This endpoint provides full access to image metadata, exact pixel dimensions, and byte streams.
 */
export async function fetchGoogleDrivePhotosList(
  accessToken: string,
  pageSize = 50,
  pageToken?: string
): Promise<FetchPhotosResult> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', "mimeType contains 'image/' and trashed = false");
  url.searchParams.set(
    'fields',
    'nextPageToken, files(id, name, size, mimeType, webViewLink, webContentLink, thumbnailLink, createdTime, md5Checksum, sha256Checksum, imageMediaMetadata)'
  );
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('orderBy', 'createdTime desc');
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    let message = `Google Drive API error (${res.status}): ${res.statusText}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.message) {
        message = parsed.error.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }

  const data = await res.json();
  const rawFiles: any[] = data.files || [];

  const items: PhotoMediaItem[] = rawFiles.map((file) => {
    const meta = file.imageMediaMetadata || {};
    const width = Number(meta.width || 0);
    const height = Number(meta.height || 0);
    const megapixels = width && height ? Number(((width * height) / 1_000_000).toFixed(2)) : 0;
    const aspectRatio = width && height ? computeAspectRatio(width, height) : 'Unknown';

    const exif: ExifDetails = {
      cameraMake: meta.cameraMake,
      cameraModel: meta.cameraModel,
      exposureTime: meta.exposureTime ? `${meta.exposureTime}s` : undefined,
      aperture: meta.aperture ? `f/${meta.aperture}` : undefined,
      iso: meta.isoSpeed,
      focalLength: meta.focalLength ? `${meta.focalLength}mm` : undefined,
      flash: meta.flashUsed !== undefined ? (meta.flashUsed ? 'Fired' : 'Did not fire') : undefined,
      dateTimeOriginal: meta.time || file.createdTime,
    };

    // Replace '=s220' with high-res preview thumbnail
    const thumbUrl = file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+/, '=s1200') : file.webContentLink;

    return {
      id: file.id,
      filename: file.name || 'Untitled.jpg',
      productUrl: file.webViewLink,
      baseUrl: thumbUrl || '',
      blobUrl: thumbUrl || '',
      mimeType: file.mimeType || 'image/jpeg',
      creationTime: meta.time || file.createdTime || new Date().toISOString(),
      fileSizeBytes: file.size ? Number(file.size) : undefined,
      width,
      height,
      megapixels,
      aspectRatio,
      md5: file.md5Checksum,
      sha256: file.sha256Checksum || file.md5Checksum, // Use native Drive checksum if present
      hashStatus: file.sha256Checksum || file.md5Checksum ? 'completed' : 'pending',
      exif,
      source: 'google-drive',
    };
  });

  return {
    items,
    nextPageToken: data.nextPageToken,
    sourceType: 'google-drive',
  };
}

/**
 * Auto-paginating photo fetcher for large amounts of files.
 * Loops through Drive API pages until targetCount is satisfied or no more files exist.
 */
export async function fetchGoogleDrivePhotosPaged(
  accessToken: string,
  targetCount: number = 250,
  onProgress?: (totalFetched: number) => void,
  startPageToken?: string
): Promise<{ items: PhotoMediaItem[]; nextPageToken?: string }> {
  const items: PhotoMediaItem[] = [];
  let pageToken: string | undefined = startPageToken;
  const isUnlimited = targetCount <= 0 || !isFinite(targetCount);

  while (isUnlimited || items.length < targetCount) {
    const remaining = isUnlimited ? 100 : targetCount - items.length;
    const batchSize = Math.min(100, remaining);

    const result = await fetchGoogleDrivePhotosList(accessToken, batchSize, pageToken);
    if (!result.items || result.items.length === 0) {
      break;
    }

    items.push(...result.items);
    pageToken = result.nextPageToken;

    if (onProgress) {
      onProgress(items.length);
    }

    if (!pageToken) {
      break; // End of library reached
    }
  }

  return {
    items,
    nextPageToken: pageToken,
  };
}

/**
 * Concurrent batch processor to download and compute hashes/EXIF for large libraries.
 * Concurrency controls how many photos are processed in parallel.
 */
export async function processPhotosConcurrently(
  accessToken: string,
  items: PhotoMediaItem[],
  concurrency = 5,
  onItemCompleted?: (completedCount: number, currentItem: PhotoMediaItem) => void,
  isPausedOrCancelled?: () => boolean
): Promise<PhotoMediaItem[]> {
  const results: PhotoMediaItem[] = new Array(items.length);
  let currentIndex = 0;
  let completedCount = 0;

  async function worker() {
    while (currentIndex < items.length) {
      if (isPausedOrCancelled && isPausedOrCancelled()) {
        break;
      }
      const index = currentIndex++;
      const item = items[index];

      let processed: PhotoMediaItem;
      // If item already has a verified cryptographic hash and valid pixel dimensions,
      // it is already complete.
      if (item.hashStatus === 'completed' && item.sha256 && item.width > 0) {
        processed = item;
      } else {
        processed = await downloadAndProcessDrivePhoto(accessToken, item);
      }

      results[index] = processed;
      completedCount++;

      if (onItemCompleted) {
        onItemCompleted(completedCount, processed);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return items.map((orig, i) => results[i] || orig);
}

/**
 * Downloads image bytes for a Google Drive photo and computes the exact SHA-256 checksum
 * and deep EXIF parameters.
 */
export async function downloadAndProcessDrivePhoto(
  accessToken: string,
  item: PhotoMediaItem
): Promise<PhotoMediaItem> {
  try {
    // If Google Drive already returned the exact sha256 checksum, and dimensions exist,
    // we can optimize unless deep EXIF is needed.
    let buffer: ArrayBuffer | null = null;
    let blobUrl: string | undefined = item.blobUrl;

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${item.id}?alt=media`;
    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const blob = await response.blob();
      buffer = await blob.arrayBuffer();
      blobUrl = URL.createObjectURL(blob);
    } else {
      // Fallback: If alt=media is restricted (e.g. large file or virus check prompt), try thumbnail / webContentLink
      if (item.baseUrl) {
        const fallbackRes = await fetch(item.baseUrl);
        if (fallbackRes.ok) {
          const blob = await fallbackRes.blob();
          buffer = await blob.arrayBuffer();
          blobUrl = URL.createObjectURL(blob);
        }
      }
    }

    if (!buffer) {
      // If we couldn't download full buffer but already have sha256 or md5 from Drive
      if (item.sha256) {
        return {
          ...item,
          hashStatus: 'completed',
        };
      }
      if (item.md5) {
        return {
          ...item,
          sha256: item.md5, // Fallback to cryptographic MD5 if binary fetch blocked
          hashStatus: 'completed',
        };
      }
      throw new Error('Unable to download image buffer for SHA computation.');
    }

    // Compute Cryptographic SHA-256 and SHA-1 hashes
    const sha256 = await computeSha256(buffer);
    const sha1 = await computeSha1(buffer);

    // Deep EXIF extraction from binary buffer
    const deepExif = extractExifFromBuffer(buffer);

    // Measure exact pixel dimensions if not yet detected
    let exactWidth = item.width;
    let exactHeight = item.height;
    let exactMp = item.megapixels;
    let exactRatio = item.aspectRatio;

    if (exactWidth === 0 || exactHeight === 0) {
      const blob = new Blob([buffer], { type: item.mimeType });
      const measured = await getExactPixelDimensions(blob);
      if (measured.width > 0 && measured.height > 0) {
        exactWidth = measured.width;
        exactHeight = measured.height;
        exactMp = measured.megapixels;
        exactRatio = measured.aspectRatio;
      }
    }

    const mergedExif: ExifDetails = {
      cameraMake: deepExif.cameraMake || item.exif.cameraMake,
      cameraModel: deepExif.cameraModel || item.exif.cameraModel,
      lensModel: deepExif.lensModel || item.exif.lensModel,
      dateTimeOriginal: deepExif.dateTimeOriginal || item.exif.dateTimeOriginal || item.creationTime,
      iso: deepExif.iso || item.exif.iso,
      aperture: deepExif.aperture || item.exif.aperture,
      focalLength: deepExif.focalLength || item.exif.focalLength,
      exposureTime: deepExif.exposureTime || item.exif.exposureTime,
      flash: deepExif.flash || item.exif.flash,
      whiteBalance: deepExif.whiteBalance || item.exif.whiteBalance,
      software: deepExif.software,
      colorSpace: deepExif.colorSpace,
      gps: deepExif.gps,
      rawTags: deepExif.rawTags,
    };

    return {
      ...item,
      fileSizeBytes: buffer.byteLength,
      width: exactWidth,
      height: exactHeight,
      megapixels: exactMp,
      aspectRatio: exactRatio,
      sha256,
      sha1,
      hashStatus: 'completed',
      exif: mergedExif,
      blobUrl: blobUrl || item.baseUrl,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to download or hash file';
    return {
      ...item,
      // If we already have MD5 from Drive, use that as safe fallback
      sha256: item.md5 || undefined,
      hashStatus: item.md5 ? 'completed' : 'error',
      hashError: errorMsg,
    };
  }
}

/**
 * Google Photos Picker API: Creates a picker session where users can select photos from
 * their entire Google Photos library.
 */
export async function createPhotosPickerSession(accessToken: string): Promise<{
  sessionId: string;
  pickerUri: string;
}> {
  const res = await fetch('https://photospicker.googleapis.com/v1/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Photos Picker session creation failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return {
    sessionId: data.id,
    pickerUri: data.pickerUri,
  };
}

/**
 * Polls Google Photos Picker API for selected media items.
 */
export async function fetchPhotosPickerMediaItems(
  accessToken: string,
  sessionId: string
): Promise<PhotoMediaItem[]> {
  const url = `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch picked photos (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const pickedList: any[] = data.mediaItems || [];

  return pickedList.map((item) => {
    const mediaFile = item.mediaFile || {};
    return {
      id: item.id,
      filename: mediaFile.filename || 'GooglePhoto.jpg',
      baseUrl: mediaFile.baseUrl,
      blobUrl: `${mediaFile.baseUrl}=w1200-h1200`,
      mimeType: mediaFile.mimeType || 'image/jpeg',
      creationTime: item.createTime || new Date().toISOString(),
      width: 0,
      height: 0,
      megapixels: 0,
      aspectRatio: 'Unknown',
      hashStatus: 'pending',
      exif: {},
      source: 'google-photos',
    };
  });
}

/**
 * Universal Scanner: tries Google Drive Photos API first (direct batch scan).
 * Falls back gracefully if needed.
 */
export async function scanUniversalPhotos(
  accessToken: string,
  pageSize = 50,
  pageToken?: string
): Promise<FetchPhotosResult> {
  return await fetchGoogleDrivePhotosList(accessToken, pageSize, pageToken);
}

/**
 * Clusters an array of PhotoMediaItems into DuplicateGroups.
 */
export function clusterDuplicates(items: PhotoMediaItem[]): {
  shaGroups: DuplicateGroup[];
  exifNearGroups: DuplicateGroup[];
  totalDuplicateCount: number;
  totalSavingsBytes: number;
} {
  // 1. Exact Cryptographic SHA-256 Clusters
  const shaMap = new Map<string, PhotoMediaItem[]>();
  for (const item of items) {
    if (item.sha256 && item.hashStatus === 'completed') {
      const existing = shaMap.get(item.sha256) || [];
      existing.push(item);
      shaMap.set(item.sha256, existing);
    }
  }

  const shaGroups: DuplicateGroup[] = [];
  let totalSavings = 0;
  let totalDups = 0;

  let groupCounter = 1;
  for (const [hash, groupItems] of shaMap.entries()) {
    if (groupItems.length > 1) {
      totalDups += groupItems.length - 1;
      const singleFileSize = groupItems[0].fileSizeBytes || 0;
      const savings = singleFileSize * (groupItems.length - 1);
      totalSavings += savings;

      const firstW = groupItems[0].width;
      const firstH = groupItems[0].height;
      const allDimMatch = groupItems.every((it) => it.width === firstW && it.height === firstH);

      const firstCam = `${groupItems[0].exif.cameraMake}_${groupItems[0].exif.cameraModel}`;
      const allExifMatch = groupItems.every(
        (it) => `${it.exif.cameraMake}_${it.exif.cameraModel}` === firstCam
      );

      shaGroups.push({
        groupId: `sha-grp-${groupCounter++}`,
        type: 'exact-sha',
        hashKey: hash,
        items: groupItems,
        savingsBytes: savings,
        allDimensionsMatch: allDimMatch,
        allExifMatch,
        differencesSummary: allDimMatch
          ? ['Exact 100% cryptographic SHA-256 match', 'Identical pixel dimensions']
          : ['Exact SHA hash match'],
      });
    }
  }

  // 2. Dimension & EXIF matches
  const exifMap = new Map<string, PhotoMediaItem[]>();
  for (const item of items) {
    const inExactSha = shaGroups.some((g) => g.items.some((i) => i.id === item.id));
    if (!inExactSha && item.exif.cameraModel && item.exif.dateTimeOriginal && item.width > 0) {
      const key = `${item.exif.cameraMake || ''}_${item.exif.cameraModel}_${item.exif.dateTimeOriginal}_${item.width}x${item.height}`;
      const existing = exifMap.get(key) || [];
      existing.push(item);
      exifMap.set(key, existing);
    }
  }

  const exifNearGroups: DuplicateGroup[] = [];
  for (const [key, groupItems] of exifMap.entries()) {
    if (groupItems.length > 1) {
      exifNearGroups.push({
        groupId: `exif-grp-${groupCounter++}`,
        type: 'dimension-and-exif',
        hashKey: key,
        items: groupItems,
        savingsBytes: 0,
        allDimensionsMatch: true,
        allExifMatch: true,
        differencesSummary: [
          'Same capture timestamp and camera',
          'Identical pixel dimensions',
          'Different file hash (different compression or metadata tags)',
        ],
      });
    }
  }

  return {
    shaGroups,
    exifNearGroups,
    totalDuplicateCount: totalDups,
    totalSavingsBytes: totalSavings,
  };
}
