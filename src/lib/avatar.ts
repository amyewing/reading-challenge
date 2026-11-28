/** The API accepts a profile picture up to this many characters (as a data URL) */
const MAX_LENGTH = 80_000;
const SIZE = 256;
/** A tiny copy for lists of people, so those pages stay light */
const THUMB_SIZE = 64;
const THUMB_MAX_LENGTH = 12_000;
/** A book cover is a portrait picture, 2 wide to 3 tall */
const COVER_WIDTH = 300;
const COVER_HEIGHT = 450;
const COVER_MAX_LENGTH = 120_000;

/** The part of a photo to keep: a rectangle, in the photo's own pixels */
export interface PhotoCrop {
  sx: number;
  sy: number;
  width: number;
  height: number;
}

/** Open a chosen file as an image, with friendly errors */
export async function loadPhoto(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error("That image couldn't be read. Try a JPEG or PNG.");
  }
}

/** Draw the cropped part at the given size and encode it as a JPEG, lowering quality until it fits. */
function cropJpeg(bitmap: ImageBitmap, crop: PhotoCrop, outW: number, outH: number, maxLength: number): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("This browser can't resize pictures.");
  ctx.fillStyle = '#fff'; // PNGs with see-through areas
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(bitmap, crop.sx, crop.sy, crop.width, crop.height, 0, 0, outW, outH);
  for (let quality = 0.85; quality >= 0.3; quality -= 0.1) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= maxLength) return url;
  }
  return null;
}

/**
 * Turn the chosen square of a photo into a small profile picture (256 x 256) as a data URL,
 * plus an even smaller copy (64 x 64) used in lists of people.
 */
export function cropToJpegs(bitmap: ImageBitmap, crop: PhotoCrop): { full: string; thumb: string } {
  const full = cropJpeg(bitmap, crop, SIZE, SIZE, MAX_LENGTH);
  const thumb = cropJpeg(bitmap, crop, THUMB_SIZE, THUMB_SIZE, THUMB_MAX_LENGTH);
  if (!full || !thumb) throw new Error('That picture is too detailed to store. Try a different one.');
  return { full, thumb };
}

/** Turn the chosen 2:3 part of a picture into a book cover (300 x 450) as a data URL */
export function cropToCoverJpeg(bitmap: ImageBitmap, crop: PhotoCrop): string {
  const image = cropJpeg(bitmap, crop, COVER_WIDTH, COVER_HEIGHT, COVER_MAX_LENGTH);
  if (!image) throw new Error('That picture is too detailed to store. Try a different one.');
  return image;
}
