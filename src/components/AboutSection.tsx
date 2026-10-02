import React from 'react';
import { ShieldCheck, Hash, Maximize2, Camera, Layers, CheckCircle2, Cpu } from 'lucide-react';

export const AboutSection: React.FC = () => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-3">
          <ShieldCheck className="w-4 h-4" />
          <span>High-Precision Deduplication Architecture</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          How PhotoSHA Identifies Google Photos Duplicates
        </h2>
        <p className="text-sm text-slate-600 mt-2 max-w-3xl leading-relaxed">
          PhotoSHA combines 256-bit cryptographic verification, exact native pixel dimension inspection, and granular EXIF metadata diffing to detect exact and near duplicates with 100% mathematical certainty.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Step 1: Cryptographic SHA-256 */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
              <Hash className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-2">1. Cryptographic SHA-256</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every photo’s raw binary stream is analyzed via the browser's hardware-accelerated Web Crypto API. If two files produce the same 64-character SHA-256 digest, they are guaranteed to be byte-for-byte binary clones.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 font-mono text-[11px] text-blue-600 truncate">
            e3b0c44298fc1c149afb...
          </div>
        </div>

        {/* Step 2: Exact Pixel Dimensions */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-4">
              <Maximize2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-2">2. Exact Pixel Dimensions</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Extracts the exact natural width and height down to the single pixel (e.g. 4032 × 3024 px), computes exact megapixels (12.19 MP), and detects aspect ratio formulas. Flags whether duplicates share identical resolution or if one is a lower-res compressed copy.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 font-mono text-[11px] text-purple-600">
            4032 × 3024 px • 12.19 MP
          </div>
        </div>

        {/* Step 3: Deep EXIF Comparison */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-4">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-2">3. Deep EXIF Matrix</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Reads embedded camera metadata headers (Camera Make, Model, Lens, Focal Length, ISO, Aperture, Exposure Shutter Speed, Color Space, and GPS Geolocation) to detect photos captured at the exact same second.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 font-mono text-[11px] text-emerald-600 truncate">
            ISO 100 • f/1.78 • 1/1200s
          </div>
        </div>
      </div>

      {/* Connecting Your Own Google Account */}
      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
            🔑
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Using PhotoSHA With Your Own Google Account</h3>
            <p className="text-xs text-slate-500">Zero backend dependencies — full personal privacy</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
            <span className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">1</span>
              Personal OAuth 2.0 Web Client ID (Recommended)
            </span>
            <p className="leading-relaxed">
              Create a free OAuth 2.0 Web Client ID in your own Google Cloud Console and add your current origin (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">http://localhost:3000</code>). Because you are accessing your own personal account with your own Client ID, Google grants immediate access without app verification delays.
            </p>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
            <span className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs">
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[11px] font-bold">2</span>
              Direct Access Token (Quick 1-Minute Scan)
            </span>
            <p className="leading-relaxed">
              Don't want to create an OAuth Client ID? Generate a temporary access token with <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">gcloud auth print-access-token</code> or Google OAuth Playground, paste it into the connection modal, and begin analyzing right away.
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Guarantee */}
      <div className="p-5 rounded-2xl bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200/80 flex items-start gap-4">
        <Cpu className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-950 space-y-1">
          <div className="font-bold text-sm text-blue-900">100% In-Browser Client-Side Processing</div>
          <p className="text-slate-600 leading-relaxed">
            Your photos are downloaded directly into your browser's private memory session to calculate SHA-256 hashes and EXIF tags. No image bytes are uploaded to external third-party servers, databases, or cloud storage.
          </p>
        </div>
      </div>
    </div>
  );
};
