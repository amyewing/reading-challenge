import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { loadPhoto, type PhotoCrop } from '../lib/avatar';

interface Props<T> {
  file: File;
  /** Width over height of the frame: 1 for a profile picture, 2/3 for a book cover */
  aspect?: number;
  /** Show a round outline (a profile picture) instead of a rectangle */
  round?: boolean;
  /** Turn the chosen part of the photo into what gets saved */
  encode: (bitmap: ImageBitmap, crop: PhotoCrop) => T;
  /** Called with the encoded result */
  onUse: (result: T) => void;
  onCancel: () => void;
  /** Saving is in progress: disable the buttons */
  busy?: boolean;
  /** Text of the main button */
  useLabel?: string;
}

const MAX_ZOOM = 4;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Frame a photo before it is saved (as a profile picture or a book cover): drag it (or use the
 * arrow keys) to move it and zoom to fit what you want. The outline shows what will be kept.
 *
 * The view is kept as a centre point in the photo's own pixels plus a zoom, so it stays right
 * if the window is resized. At 1x the photo just covers the frame.
 */
export default function PhotoCropper<T>({
  file,
  aspect = 1,
  round = true,
  encode,
  onUse,
  onCancel,
  busy = false,
  useLabel = 'Use this photo',
}: Props<T>) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [center, setCenter] = useState({ x: 0, y: 0 }); // in photo pixels
  const [zoom, setZoom] = useState(1);
  const [box, setBox] = useState(0); // width of the square view, in screen pixels
  const viewRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null);

  // Open the file
  useEffect(() => {
    let live = true;
    let objectUrl: string | null = null;
    let opened: ImageBitmap | null = null;
    loadPhoto(file)
      .then((b) => {
        if (!live) return b.close();
        opened = b;
        objectUrl = URL.createObjectURL(file);
        setBitmap(b);
        setUrl(objectUrl);
        setCenter({ x: b.width / 2, y: b.height / 2 });
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
      opened?.close();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // Follow the view's size on screen
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const measure = () => setBox(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [bitmap]);

  const w = bitmap?.width ?? 1;
  const h = bitmap?.height ?? 1;
  // How much of the photo shows (in photo pixels): at 1x the largest frame-shaped piece that fits
  const baseWidth = w / h >= aspect ? h * aspect : w;
  const cw = baseWidth / zoom;
  const ch = cw / aspect;
  const scale = box ? box / cw : 1; // screen pixels per photo pixel
  const boxHeight = box / aspect;

  /** Keep the photo covering the whole frame */
  const keepInside = (x: number, y: number, viewW: number, viewH: number) => ({
    x: clamp(x, viewW / 2, w - viewW / 2),
    y: clamp(y, viewH / 2, h - viewH / 2),
  });
  const at = keepInside(center.x, center.y, cw, ch);

  function changeZoom(next: number) {
    const z = clamp(next, 1, MAX_ZOOM);
    const newW = baseWidth / z;
    setZoom(z);
    setCenter(keepInside(at.x, at.y, newW, newW / aspect));
  }

  // The mouse wheel zooms (a native listener, so the page doesn't scroll as well)
  const wheel = useRef((_: WheelEvent) => {});
  wheel.current = (e) => {
    e.preventDefault();
    changeZoom(zoom * Math.exp(-e.deltaY * 0.0015));
  };
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => wheel.current(e);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [bitmap]);

  function down(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, cx: at.x, cy: at.y };
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setCenter(keepInside(d.cx - (e.clientX - d.px) / scale, d.cy - (e.clientY - d.py) / scale, cw, ch));
  }
  function up() {
    drag.current = null;
  }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    const step = cw * 0.05;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      setCenter(keepInside(at.x + m[0], at.y + m[1], cw, ch));
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      changeZoom(zoom * 1.1);
    } else if (e.key === '-') {
      e.preventDefault();
      changeZoom(zoom / 1.1);
    }
  }

  function use() {
    if (!bitmap) return;
    try {
      onUse(encode(bitmap, { sx: at.x - cw / 2, sy: at.y - ch / 2, width: cw, height: ch }));
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="cropper">
      {error && <p className="error">{error}</p>}
      {!error && !bitmap && <p className="muted small">Opening your photo…</p>}
      {bitmap && url && (
        <>
          <div
            ref={viewRef}
            className={`cropper-view ${round ? '' : 'rect'}`}
            style={{ aspectRatio: String(aspect) }}
            tabIndex={0}
            role="group"
            aria-label="Photo position. Drag the photo or use the arrow keys to move it, and plus and minus to zoom."
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={key}
          >
            <img
              src={url}
              alt=""
              draggable={false}
              style={{
                width: w * scale,
                height: h * scale,
                left: box / 2 - at.x * scale,
                top: boxHeight / 2 - at.y * scale,
              }}
            />
          </div>
          <label className="cropper-zoom small">
            Zoom
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => changeZoom(Number(e.target.value))}
              aria-label="Zoom"
            />
          </label>
          <p className="small muted">
            Drag the photo to move it. {round ? 'The circle is what people will see.' : 'The outline is what will be kept.'}
          </p>
        </>
      )}
      <div className="row dialog-actions">
        <span className="grow" />
        <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className="primary" disabled={!bitmap || busy} onClick={use}>
          {busy ? 'Saving…' : useLabel}
        </button>
      </div>
    </div>
  );
}
