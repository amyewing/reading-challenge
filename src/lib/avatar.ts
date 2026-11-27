/** The API accepts a profile picture up to this many characters (as a data URL) */
const MAX_LENGTH = 80_000;
const SIZE = 256;

/**
 * Turn a chosen photo into a small square JPEG (centre-cropped, 256 x 256) as a data URL,
 * lowering the quality until it is small enough to store.
 */
export async function shrinkPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image couldn't be read. Try a JPEG or PNG.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("This browser can't resize pictures.");
  ctx.fillStyle = '#fff'; // PNGs with see-through areas
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();

  for (let quality = 0.85; quality >= 0.3; quality -= 0.1) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= MAX_LENGTH) return url;
  }
  throw new Error('That picture is too detailed to store. Try a different one.');
}
