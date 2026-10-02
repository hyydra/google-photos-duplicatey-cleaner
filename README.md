# PhotoSHA — Google Photos Cryptographic Duplicate Finder

PhotoSHA is an open-source, client-side web application designed to find and manage duplicate photos using 256-bit cryptographic SHA hashes, pixel-for-pixel dimension verification, and deep EXIF metadata comparisons.

## 🚀 Key Features

* **Zero False Positives via Cryptographic Hashes**: Computes SHA-256 and SHA-1 checksums on raw image bytes in the browser via native Web Cryptography (`crypto.subtle`).
* **Deep EXIF Diffing**: Extracts and displays side-by-side metadata comparisons (camera model, lens, exposure time, aperture, ISO, GPS coordinates, timestamps).
* **Exact Pixel Verification**: Measures exact native image dimensions (width × height px), megapixels, and aspect ratios.
* **Multiple Sources**:
  * **Google Photos & Google Drive**: Authenticates via Google OAuth (`drive.readonly`, `photospicker.mediaitems.readonly`) with auto-pagination for large libraries.
  * **Local File Dropzone**: Drag and drop local photo folders or Google Takeout exports for offline deduplication without uploading anything to a server.
  * **Interactive Demo Dataset**: Test immediately with pre-loaded high-resolution samples without connecting an account.
* **Performance & Scale**:
  * 5x concurrency worker pool for downloading and hashing.
  * IndexedDB caching with localStorage fallback to store scan results across browser sessions.
  * Virtualized/paginated rendering to handle thousands of images smoothly.
* **Exportable Reports**: Generate detailed duplicate analysis reports in CSV or JSON format.

---

## 🛠️ Quick Start

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/)

### 2. Install Dependencies
```bash
bun install
# or
npm install
```

### 3. Run Development Server
```bash
bun run dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Connecting Your Google Account

PhotoSHA offers three flexible, secure ways for anyone to connect their own Google account:

### Method 1: Using Your Own Google OAuth Client ID (Recommended)
Because Google Photos requires sensitive scopes (`drive.readonly`), using your own free Client ID allows you to access your personal account with **no app verification warnings** and **complete privacy** (all tokens stay in your browser):
1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), enable the **Google Drive API**.
2. Create an **OAuth 2.0 Client ID** with type **Web application**.
3. Under **Authorized JavaScript origins**, add your local URL: `http://localhost:3000` (or `http://localhost:5173`).
4. Click the **Key icon** in PhotoSHA's top bar, paste your Client ID, and click **Sign In & Authorize Scan**.
*(Your Client ID is stored locally in your browser so you only need to enter it once).*

### Method 2: Direct Access Token (Fastest / 1-Minute Scan)
If you just want to run a quick test without creating a Client ID:
1. Generate a temporary OAuth token via:
   * [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground) (select `drive.readonly` and exchange for tokens).
   * Or from terminal: `gcloud auth print-access-token`
2. Click the **Key icon** in PhotoSHA → select **Direct Access Token** → paste and click **Verify & Connect**.

### Method 3: Offline / Local Mode (Zero Setup)
Switch to the **Local Files** tab to drag and drop Google Takeout folders or local image archives. All hashes and EXIF diffs are computed 100% offline in your browser using hardware-accelerated Web Crypto.

### Optional: Pre-configure via Environment Variables
To preset a default Client ID across builds, add it to `.env.local`:
```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

---

## 🏗️ Build & Quality Checks

* **Typecheck**: `bun run lint` (or `npm run lint`)
* **Production Build**: `bun run build` (or `npm run build`)
* **Preview Bundle**: `bun run preview` (or `npm run preview`)

---

## 📄 License
Apache-2.0
