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

## 🔐 Environment Configuration (Optional)

The application works out of the box for **Local File Drops** and **Demo Sample Mode** without any API keys.

To connect to live Google Photos / Google Drive libraries:
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Create a Firebase project with Google Sign-in enabled and add your Web App credentials:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```
3. Enable the **Google Drive API** and **Google Photos Picker API** in the Google Cloud Console for your project.

---

## 🏗️ Build & Quality Checks

* **Typecheck**: `bun run lint` (or `npm run lint`)
* **Production Build**: `bun run build` (or `npm run build`)
* **Preview Bundle**: `bun run preview` (or `npm run preview`)

---

## 📄 License
Apache-2.0
