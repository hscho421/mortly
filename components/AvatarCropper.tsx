import { useState, useCallback, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "next-i18next";
import type { Area, CropperProps } from "react-easy-crop";
import { getCroppedAvatar } from "@/lib/resizeImage";

// Dynamic import keeps react-easy-crop out of the main bundle — it only loads
// when a broker actually opens the cropper. Cast to Partial props: next/dynamic
// erases the library's defaultProps typing (which would otherwise mark many
// optional props as required); the library still applies those defaults at
// runtime.
const Cropper = dynamic(() => import("react-easy-crop"), {
  ssr: false,
}) as unknown as ComponentType<Partial<CropperProps>>;

/**
 * Modal that lets the user position + zoom a square crop over their picked
 * image before it becomes their avatar (previously we blindly center-cropped,
 * which could cut off a face). On save, produces a ≤512px JPEG blob.
 */
export default function AvatarCropper({
  imageSrc,
  onCancel,
  onCropped,
}: {
  imageSrc: string;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}) {
  const { t } = useTranslation("common");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_area: Area, areaPx: Area) => {
    setAreaPixels(areaPx);
  }, []);

  const handleSave = async () => {
    if (!areaPixels) return;
    setBusy(true);
    try {
      const blob = await getCroppedAvatar(imageSrc, areaPixels);
      onCropped(blob);
    } catch {
      // Surface nothing fancy here; the caller shows upload errors. Re-enable
      // the button so the user can retry.
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-forest-900/55 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-sm bg-cream-50 shadow-xl">
        <div className="px-5 py-3 border-b border-cream-300">
          <p className="font-body text-sm font-semibold text-forest-800">
            {t("broker.cropTitle", "Position your photo")}
          </p>
        </div>

        {/* Crop area */}
        <div className="relative h-72 bg-forest-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom control */}
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-sage-500">
            {t("broker.cropZoom", "Zoom")}
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-forest-700"
            aria-label={t("broker.cropZoom", "Zoom")}
          />
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn-secondary text-sm py-2.5 px-3"
          >
            {t("broker.cropCancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !areaPixels}
            className="rounded-sm bg-forest-800 px-4 py-2.5 text-sm font-body font-semibold text-cream-100 hover:bg-forest-700 disabled:opacity-50"
          >
            {busy ? t("broker.cropSaving", "Saving…") : t("broker.cropSave", "Save photo")}
          </button>
        </div>
      </div>
    </div>
  );
}
