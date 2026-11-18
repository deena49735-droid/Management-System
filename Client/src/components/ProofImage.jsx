import React, { useState, useEffect } from 'react';

const ProofImage = ({ src, alt = 'Proof photo', prominent = false, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!src) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium">
        <svg className="h-3.5 w-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        No image
      </span>
    );
  }

  return (
    <>
      {prominent ? (
        <div className={`group relative inline-block ${className}`}>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/60 p-1.5 pr-3 text-left transition hover:bg-brand-100/70 hover:border-brand-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
            title="Click to view full proof image"
          >
            <img
              src={src}
              alt={alt}
              className="h-10 w-10 rounded-lg object-cover border border-brand-200 shadow-2xs group-hover:scale-105 transition"
              loading="lazy"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                View Proof
                <svg className="h-3 w-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </span>
              <span className="text-xs text-brand-700/80">Tap to expand</span>
            </div>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`group relative inline-flex items-center justify-center rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs hover:border-brand-300 hover:ring-2 hover:ring-brand-500/20 transition focus:outline-hidden ${className}`}
          title="Click to inspect proof photo"
        >
          <img
            src={src}
            alt={alt}
            className="h-9 w-9 object-cover transition group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition flex items-center justify-center">
            <svg className="h-3.5 w-3.5 text-white opacity-0 group-hover:opacity-100 transition drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
        </button>
      )}

      {/* Lightbox Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          {/* Backdrop overlay (tap outside to close) */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Lightbox Content Card */}
          <div
            className="relative z-10 w-full max-w-3xl rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-800 overflow-hidden my-4"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h4 className="text-sm sm:text-base font-semibold text-white">Proof Photo</h4>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition"
                  title="Open original full resolution image in new tab"
                >
                  <span>Open original</span>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition focus:outline-hidden"
                  aria-label="Close lightbox"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Image Container */}
            <div className="flex items-center justify-center bg-black/40 p-2 sm:p-4 max-h-[75dvh] overflow-hidden">
              <img
                src={src}
                alt={alt}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProofImage;

