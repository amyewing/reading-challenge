/** The API accepts a profile picture up to this many characters (as a data URL) */
const MAX_LENGTH = 80_000;
const SIZE = 256;
/** A tiny copy for lists of people, so those pages stay light */
const THUMB_SIZE = 64;
const THUMB_MAX_LENGTH = 12_000;

/** Centre-crop the bitmap to a square of `size` and encode it as a JPEG, lowering quality until it fits. */
function squareJpeg(bitmap: ImageBitmap, size: number, maxLength: number): string | null {
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("This browser can't resize pictures.");
  ctx.fillStyle = '#fff'; // PNGs with see-through areas
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  for (let quality = 0.85; quality >= 0.3; quality -= 0.1) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= maxLength) return url;
  }
  return null;
}

/**
 * Turn a chosen photo into a small square JPEG (centre-cropped, 256 x 256) as a data URL,
 * plus an even smaller copy (64 x 64) used in lists of people.
 */
export async function shrinkPhoto(file: File): Promise<{ full: string; thumb: string }> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image couldn't be read. Try a JPEG or PNG.");
  }
  try {
    const full = squareJpeg(bitmap, SIZE, MAX_LENGTH);
    const thumb = squareJpeg(bitmap, THUMB_SIZE, THUMB_MAX_LENGTH);
    if (!full || !thumb) throw new Error('That picture is too detailed to store. Try a different one.');
    return { full, thumb };
  } finally {
    bitmap.close();
  }
}
