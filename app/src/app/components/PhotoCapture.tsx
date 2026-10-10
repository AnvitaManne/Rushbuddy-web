/**
 * Shared photo-capture control (Phase 17).
 * Uses the OS camera / gallery via a hidden file input; shows a thumbnail preview.
 */

import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';

export interface PhotoCaptureProps {
  label?: string;
  disabled?: boolean;
  uploading?: boolean;
  previewUrl?: string | null;
  captured?: boolean;
  onFileSelected: (file: File) => void | Promise<void>;
  /** Prefer rear camera on phones when the OS supports it. */
  preferCamera?: boolean;
}

export function PhotoCapture({
  label = 'Take / choose photo',
  disabled,
  uploading,
  previewUrl,
  captured,
  onFileSelected,
  preferCamera = true,
}: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const shownPreview = previewUrl || localPreview;

  const openPicker = () => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  };

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file later.
    e.target.value = '';
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
    await onFileSelected(file);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={preferCamera ? 'environment' : undefined}
        className="hidden"
        onChange={onChange}
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={disabled || uploading}
        className="text-xs px-3 py-1.5 rounded-lg transition-all inline-flex items-center gap-1.5"
        style={{
          background: captured ? '#F3F2EF' : '#ffffff',
          border: `1px solid ${captured ? '#0B2340' : 'rgba(11,35,64,0.12)'}`,
          color: captured ? '#0B2340' : '#6B7684',
          opacity: uploading ? 0.7 : 1,
        }}
      >
        {uploading ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            Uploading…
          </>
        ) : captured ? (
          <>
            <Camera size={12} />
            ✓ Photo captured — tap to replace
          </>
        ) : (
          <>
            <ImagePlus size={12} />
            {label}
          </>
        )}
      </button>

      {shownPreview && (
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: '1px solid #1E2D45', maxWidth: 220 }}
        >
          <img
            src={shownPreview}
            alt="Evidence preview"
            className="w-full block"
            style={{ maxHeight: 160, objectFit: 'cover' }}
          />
        </div>
      )}
    </div>
  );
}
