import { PhotoMediaItem } from '../types';

const DB_NAME = 'PhotoShaDB';
const DB_VERSION = 1;
const STORE_NAME = 'scan_cache';
const META_KEY = 'scan_metadata';
const LS_FALLBACK_KEY = 'photosha_scan_results_v1';
const LS_TIMESTAMP_KEY = 'photosha_scan_timestamp';

export interface ScanCacheData {
  photos: PhotoMediaItem[];
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves completed scan results to IndexedDB (with localStorage fallback).
 * Effortlessly scales to tens of thousands of photos without hitting the 5MB localStorage quota limit.
 */
export async function saveCachedScan(photos: PhotoMediaItem[]): Promise<boolean> {
  if (!photos || photos.length === 0) return false;

  // Sanitize items: strip object URLs
  const serializablePhotos = photos.map((photo) => {
    const { blobUrl, ...rest } = photo;
    return {
      ...rest,
      baseUrl: photo.baseUrl?.startsWith('blob:') ? '' : photo.baseUrl,
    };
  });

  const timestamp = Date.now();

  // Try IndexedDB first
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(serializablePhotos, 'photos');
      store.put(timestamp, META_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch (idbErr) {
    console.warn('IndexedDB write failed, falling back to localStorage:', idbErr);
  }

  // Fallback to localStorage (trimmed if needed)
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(serializablePhotos.slice(0, 1000)));
    localStorage.setItem(LS_TIMESTAMP_KEY, String(timestamp));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads cached scan results from IndexedDB or localStorage.
 */
export async function loadCachedScan(): Promise<ScanCacheData | null> {
  // 1. Try IndexedDB
  try {
    const db = await openDB();
    const result = await new Promise<{ photos: PhotoMediaItem[]; timestamp: number } | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getPhotos = store.get('photos');
      const getMeta = store.get(META_KEY);

      tx.oncomplete = () => {
        const rawPhotos = getPhotos.result;
        const rawTime = getMeta.result;
        if (Array.isArray(rawPhotos) && rawPhotos.length > 0) {
          const photos: PhotoMediaItem[] = rawPhotos.map((item) => ({
            ...item,
            blobUrl: item.baseUrl || undefined,
          }));
          resolve({
            photos,
            timestamp: typeof rawTime === 'number' ? rawTime : Date.now(),
          });
        } else {
          resolve(null);
        }
      };
      tx.onerror = () => reject(tx.error);
    });

    if (result) return result;
  } catch (idbErr) {
    console.warn('IndexedDB read failed, trying localStorage:', idbErr);
  }

  // 2. Fallback to localStorage
  try {
    const rawData = localStorage.getItem(LS_FALLBACK_KEY);
    const rawTime = localStorage.getItem(LS_TIMESTAMP_KEY);
    if (!rawData) return null;

    const parsed: PhotoMediaItem[] = JSON.parse(rawData);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const photos: PhotoMediaItem[] = parsed.map((item) => ({
      ...item,
      blobUrl: item.baseUrl || undefined,
    }));

    return {
      photos,
      timestamp: rawTime ? Number(rawTime) : Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Clears the cached scan results from both IndexedDB and localStorage.
 */
export async function clearCachedScan(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }

  try {
    localStorage.removeItem(LS_FALLBACK_KEY);
    localStorage.removeItem(LS_TIMESTAMP_KEY);
  } catch {
    // ignore
  }
}
