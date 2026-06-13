/**
 * Client-side avatar image helpers. Browser-only (Image/canvas).
 *
 * The user chooses the crop region in the cropper UI (react-easy-crop), which
 * yields a pixel rect in the image's natural coordinates. We draw that rect
 * into a square canvas at most `size`×`size` and re-encode to WebP — which
 * caps storage (~100–200KB) AND strips EXIF/GPS (canvas re-encode drops all
 * original metadata).
 */
export interface PixelArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function getCroppedWebp(
  imageSrc: string,
  area: PixelArea,
  { size = 512, quality = 0.85 }: { size?: number; quality?: number } = {},
): Promise<Blob> {
  const img = await loadImage(imageSrc);
  // Don't upscale beyond the cropped region's resolution.
  const target = Math.min(size, Math.round(area.width), Math.round(area.height)) || size;
  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, target, target);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) throw new Error("Could not process the image");
  return blob;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image file"));
    img.src = src;
  });
}
