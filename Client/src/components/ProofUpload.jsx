import React, { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import api from '../api/axios';

const ProofUpload = ({
  value = '',
  onChange,
  onUploadingChange,
  required = false,
  disabled = false,
}) => {
  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState(''); // 'compressing' | 'uploading'
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [localPreview, setLocalPreview] = useState('');

  const updateUploading = (isUploading) => {
    setUploading(isUploading);
    if (onUploadingChange) {
      onUploadingChange(isUploading);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    // Reset file input value so re-selecting the same file fires change event
    e.target.value = '';

    if (!file) return;

    setError('');

    // Check file type
    if (!file.type || !file.type.startsWith('image/')) {
      setError('Invalid file type. Please select an image (JPEG, PNG, or WebP).');
      return;
    }

    // Safety limit on initial raw size before compression (e.g. 30MB)
    if (file.size > 30 * 1024 * 1024) {
      setError('Original image is too large (over 30 MB). Please choose a smaller file.');
      return;
    }

    // Generate local preview immediately for UX
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);

    try {
      updateUploading(true);
      setStage('compressing');
      setProgress(15);

      // Compress to max 1 MB and max 1600px longest dimension
      const compressionOptions = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
      };

      const compressedFile = await imageCompression(file, compressionOptions);

      setStage('uploading');
      setProgress(30);

      // Upload to server /api/uploads/proof
      const formData = new FormData();
      formData.append('image', compressedFile, compressedFile.name || file.name || 'proof.jpg');

      const response = await api.post('/uploads/proof', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.min(
              95,
              30 + Math.round((progressEvent.loaded * 65) / progressEvent.total)
            );
            setProgress(percent);
          }
        },
      });

      setProgress(100);

      const { url, publicId } = response.data.data;
      if (onChange) {
        onChange({ url, publicId });
      }
    } catch (err) {
      console.error('Proof upload failed:', err);
      const serverMsg = err.response?.data?.message;
      const genericMsg = err.message || 'Network error occurred during photo upload.';
      setError(serverMsg || genericMsg);
      // Revert preview on failure if there was no prior value
      if (!value) {
        setLocalPreview('');
      }
    } finally {
      updateUploading(false);
      setStage('');
    }
  };

  const handleRemove = () => {
    setLocalPreview('');
    setError('');
    if (onChange) {
      onChange({ url: '', publicId: '' });
    }
  };

  const handleChooseClick = () => {
    if (disabled || uploading) return;
    setError('');
    fileInputRef.current?.click();
  };

  const currentDisplayUrl = localPreview || value;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700">
          Photo Proof {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
        {required && (
          <span className="text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
            Proof Required
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || uploading}
      />

      {/* Uploading Progress State */}
      {uploading && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-indigo-900 flex items-center gap-1.5">
              <svg className="h-4 w-4 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              {stage === 'compressing' ? 'Optimizing photo (max 1 MB)...' : `Uploading photo... ${progress}%`}
            </span>
            <span className="text-indigo-600 font-bold">{progress}%</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-100">
            <div
              className="h-full bg-indigo-600 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Uploaded Preview State */}
      {!uploading && currentDisplayUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-black/5">
            <img
              src={currentDisplayUrl}
              alt="Proof preview"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">
              Proof image attached
            </p>
            <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Ready to submit
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleChooseClick}
              disabled={disabled}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}

      {/* Empty State: Take photo / Choose image button */}
      {!uploading && !currentDisplayUrl && (
        <div>
          <button
            type="button"
            onClick={handleChooseClick}
            disabled={disabled}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition ${
              required
                ? 'border-indigo-300 bg-indigo-50/30 hover:bg-indigo-50/60'
                : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100/70'
            } disabled:opacity-50 cursor-pointer`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-2xs text-indigo-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Take photo / Choose image
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                JPEG, PNG, or WebP (auto-optimized to ~1 MB)
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 px-3 py-2 rounded-xl border border-rose-200">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default ProofUpload;

