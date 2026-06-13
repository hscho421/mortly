/**
 * Client-side avatar resize. Browser-only (uses Image/canvas).
 *
 * Center-crops to a square and downscales to at most `size`×`size`, then
 * re-encodes to WebP. This is the storage-cost lever (a 5–10MB phone photo
 * becomes ~100–200KB) AND it strips EXIF/GPS metadata for free (re-encoding
 * from a canvas drops all original metadata).
 *
 * Throws on a non-image / decode failure so the caller can show an error.
 */
export async function resizeAvatar(
  file: File,
  { size = 512, quality = 0.85 }: { size?: number; quality?: number } = {},
): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selected file is not an image");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);

    // Center-crop to a square using the shorter side.
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;

    // Don't upscale: target is min(size, side).
    const target = Math.min(size, side);
    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (!blob) throw new Error("Could not process the image");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image file"));
    img.src = src;
  });
}
