import ExifReader from 'exifreader';
import { ExifDetails, PhotoMediaItem } from '../types';

/**
 * Calculates SHA-256 hash string for an ArrayBuffer using Web Crypto API.
 */
export async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculates SHA-1 hash string for an ArrayBuffer using Web Crypto API.
 */
export async function computeSha1(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extracts deep EXIF details from raw image ArrayBuffer.
 */
export function extractExifFromBuffer(buffer: ArrayBuffer): ExifDetails {
  try {
    const tags: any = ExifReader.load(buffer, { expanded: true });
    const exifTags = tags.exif || {};
    const iptcTags = tags.iptc || {};
    const gpsTags = tags.gps || {};

    const rawTagsRecord: Record<string, string> = {};
    for (const [k, v] of Object.entries(tags)) {
      if (typeof v === 'object' && v !== null && 'description' in (v as Record<string, unknown>)) {
        rawTagsRecord[k] = String((v as { description: unknown }).description);
      }
    }

    const cameraMake = tags.Make?.description || exifTags.Make?.description;
    const cameraModel = tags.Model?.description || exifTags.Model?.description;
    const lensModel = tags.LensModel?.description || exifTags.LensModel?.description;
    const dateTimeOriginal =
      tags.DateTimeOriginal?.description ||
      exifTags.DateTimeOriginal?.description ||
      tags.DateTime?.description;

    const iso = tags.ISOSpeedRatings?.description || exifTags.ISOSpeedRatings?.description;
    const aperture = tags.FNumber?.description || exifTags.FNumber?.description;
    const focalLength = tags.FocalLength?.description || exifTags.FocalLength?.description;
    const exposureTime = tags.ExposureTime?.description || exifTags.ExposureTime?.description;
    const flash = tags.Flash?.description || exifTags.Flash?.description;
    const whiteBalance = tags.WhiteBalance?.description || exifTags.WhiteBalance?.description;
    const software = tags.Software?.description || exifTags.Software?.description;
    const colorSpace = tags.ColorSpace?.description || exifTags.ColorSpace?.description;

    let gps: ExifDetails['gps'] | undefined;
    if (gpsTags.Latitude && gpsTags.Longitude) {
      gps = {
        latitude: typeof gpsTags.Latitude === 'number' ? gpsTags.Latitude : undefined,
        longitude: typeof gpsTags.Longitude === 'number' ? gpsTags.Longitude : undefined,
        altitude: typeof gpsTags.Altitude === 'number' ? gpsTags.Altitude : undefined,
      };
    }

    return {
      cameraMake,
      cameraModel,
      lensModel,
      dateTimeOriginal,
      iso,
      aperture,
      focalLength,
      exposureTime,
      flash,
      whiteBalance,
      software,
      colorSpace,
      gps,
      rawTags: rawTagsRecord,
    };
  } catch (err) {
    // If not a JPEG or lacks EXIF
    return {};
  }
}

/**
 * Calculates exact pixel dimensions and aspect ratio from an image Blob or ArrayBuffer.
 */
export async function getExactPixelDimensions(
  blob: Blob
): Promise<{ width: number; height: number; megapixels: number; aspectRatio: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);

      const megapixels = Number(((width * height) / 1_000_000).toFixed(2));
      const aspectRatio = computeAspectRatio(width, height);
      resolve({ width, height, megapixels, aspectRatio });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0, megapixels: 0, aspectRatio: 'Unknown' });
    };
    img.src = url;
  });
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function computeAspectRatio(width: number, height: number): string {
  if (!width || !height) return 'Unknown';
  const divisor = gcd(width, height);
  const w = width / divisor;
  const h = height / divisor;

  // Common standard ratios check
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.01) return '1:1 (Square)';
  if (Math.abs(ratio - 4 / 3) < 0.02) return '4:3 (Standard)';
  if (Math.abs(ratio - 3 / 4) < 0.02) return '3:4 (Portrait)';
  if (Math.abs(ratio - 16 / 9) < 0.02) return '16:9 (Widescreen)';
  if (Math.abs(ratio - 9 / 16) < 0.02) return '9:16 (Story/Reel)';
  if (Math.abs(ratio - 3 / 2) < 0.02) return '3:2 (Classic 35mm)';
  if (Math.abs(ratio - 2 / 3) < 0.02) return '2:3 (Portrait 35mm)';

  return `${w}:${h}`;
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return 'Unknown size';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const num = (bytes / Math.pow(k, i)).toFixed(2);
  return `${num} ${sizes[i]}`;
}

/**
 * Compares two PhotoMediaItems and returns list of exact differences.
 */
export function comparePhotoDetails(
  a: PhotoMediaItem,
  b: PhotoMediaItem
): {
  isShaIdentical: boolean;
  areDimensionsIdentical: boolean;
  differences: { field: string; valA: string; valB: string; identical: boolean }[];
} {
  const isShaIdentical = !!a.sha256 && !!b.sha256 && a.sha256 === b.sha256;
  const areDimensionsIdentical = a.width === b.width && a.height === b.height;

  const diffs: { field: string; valA: string; valB: string; identical: boolean }[] = [];

  const addDiff = (field: string, valA: any, valB: any) => {
    const sA = valA !== undefined && valA !== null && valA !== '' ? String(valA) : '—';
    const sB = valB !== undefined && valB !== null && valB !== '' ? String(valB) : '—';
    diffs.push({
      field,
      valA: sA,
      valB: sB,
      identical: sA === sB,
    });
  };

  addDiff('SHA-256 Hash', a.sha256 ? a.sha256.substring(0, 16) + '...' : 'Pending', b.sha256 ? b.sha256.substring(0, 16) + '...' : 'Pending');
  addDiff('Exact Dimensions', `${a.width} × ${a.height} px`, `${b.width} × ${b.height} px`);
  addDiff('Megapixels', `${a.megapixels} MP`, `${b.megapixels} MP`);
  addDiff('Aspect Ratio', a.aspectRatio, b.aspectRatio);
  addDiff('File Size', formatBytes(a.fileSizeBytes), formatBytes(b.fileSizeBytes));
  addDiff('MIME Type', a.mimeType, b.mimeType);

  // EXIF Fields
  addDiff('Camera Make', a.exif.cameraMake, b.exif.cameraMake);
  addDiff('Camera Model', a.exif.cameraModel, b.exif.cameraModel);
  addDiff('Lens Model', a.exif.lensModel, b.exif.lensModel);
  addDiff('Capture Time (EXIF)', a.exif.dateTimeOriginal, b.exif.dateTimeOriginal);
  addDiff('Google Photos Creation', a.creationTime, b.creationTime);
  addDiff('Focal Length', a.exif.focalLength, b.exif.focalLength);
  addDiff('Aperture (F-Stop)', a.exif.aperture, b.exif.aperture);
  addDiff('ISO Speed', a.exif.iso, b.exif.iso);
  addDiff('Exposure Time', a.exif.exposureTime, b.exif.exposureTime);
  addDiff('Flash', a.exif.flash, b.exif.flash);
  addDiff('White Balance', a.exif.whiteBalance, b.exif.whiteBalance);
  addDiff('Color Space', a.exif.colorSpace, b.exif.colorSpace);

  return {
    isShaIdentical,
    areDimensionsIdentical,
    differences: diffs,
  };
}
