import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cropToJpegs, loadPhoto } from '../lib/avatar';

interface Props {
  file: File;
  /** The cropped photo, ready to save (full size and the small copy for lists) */
  onUse: (photo: { full: string; thumb: string }) => void;
  onCancel: () => void;
}

const MAX_ZOOM = 4;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Frame a photo before it becomes a profile picture: drag it (or use the arrow keys) to move it
 * and zoom to fit what you want. The round outline shows how the picture will look.
 *
 * The view is kept as a centre point in the photo's own pixels plus a zoom, so it stays right
 * if the window is resized. At 1x the photo just covers the square.
 */
export default function PhotoCropper({ file, onUse, onCancel }: Props) {
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
  const shortSide = Math.min(w, h);
  const side = shortSide / zoom; // how much of the photo shows, in photo pixels
  const scale = box ? box / side : 1; // screen pixels per photo pixel

  /** Keep the photo covering the whole square */
  const keepInside = (x: number, y: number, s: number) => ({
    x: clamp(x, s / 2, w - s / 2),
    y: clamp(y, s / 2, h - s / 2),
  });
  const at = keepInside(center.x, center.y, side);

  function changeZoom(next: number) {
    const z = clamp(next, 1, MAX_ZOOM);
    setZoom(z);
    setCenter(keepInside(at.x, at.y, shortSide / z));
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
    setCenter(keepInside(d.cx - (e.clientX - d.px) / scale, d.cy - (e.clientY - d.py) / scale, side));
  }
  function up() {
    drag.current = null;
  }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    const step = side * 0.05;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      setCenter(keepInside(at.x + m[0], at.y + m[1], side));
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
      onUse(cropToJpegs(bitmap, { sx: at.x - side / 2, sy: at.y - side / 2, side }));
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
            className="cropper-view"
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
                top: box / 2 - at.y * scale,
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
          <p className="small muted">Drag the photo to move it. The circle is what people will see.</p>
        </>
      )}
      <div className="row dialog-actions">
        <span className="grow" />
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary" disabled={!bitmap} onClick={use}>Use this photo</button>
      </div>
    </div>
  );
}
