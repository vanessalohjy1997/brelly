/**
 * The open umbrella, drawn rather than set as a ligature.
 *
 * `Icons.umbrella` is Material Symbols' `umbrella`, and that glyph is a
 * *furled* umbrella — a narrow two-panel body tapering to a point with the
 * hook at the top. SF Symbols' `umbrella.fill` is an open canopy, so the phone
 * draws drops falling onto an umbrella and the web drew them falling around a
 * closed stick. `beach_access` is the only open canopy in the Material set and
 * it is a tilted beach parasol, which is a different object again.
 *
 * SF Symbols cannot be the shared asset — it is Apple's font, licensed to
 * Apple's platforms, and cannot be served to a browser. What *can* be shared
 * is the mark the app already owns: the canopy and hook of the Brelly icon, in
 * `apps/mobile/assets/icon/light-hook.svg` and in `app/icon.svg` beside it.
 * The three path strings below are copied from that file verbatim and
 * `umbrellaMark.test.tsx` compares them against it character for character, so
 * the watermark, the tab icon and the home-screen icon are one drawing.
 *
 * (Android draws the furled Material glyph too and is not fixed by this — the
 * phone has no SVG renderer installed. See `NOTES.md`.)
 */

/** The canopy: a dome with four scalloped panels along its lower edge. */
export const CANOPY_PATH =
  "M 196,540 C 196,363.632 336.62,248 512,248 C 687.38,248 828,363.632 828,540 Q 749,485.98 670,540 Q 591,485.98 512,540 Q 433,485.98 354,540 Q 275,485.98 196,540 Z";

/** The shaft, and the J it turns into at the bottom. */
export const HANDLE_PATH = "M 512,500 L 512,796 A 78,78 0 0 1 668,796";

/**
 * The mark's own bounding box inside the icon's 1024 canvas — the canopy's
 * full width, the ferrule's top, and the hook's lowest point plus half a
 * stroke. Tight, because the frame this is placed in supplies the padding.
 */
export const MARK_VIEW_BOX = "196 196 632 699";

/** Width ÷ height of `MARK_VIEW_BOX`, for sizing the box without distortion. */
export const MARK_ASPECT = 632 / 699;

/**
 * The stroke the icon file draws the shaft and ferrule with, and the heavier
 * one the small sizes need.
 *
 * At 24px the mark is 19px tall, which puts a 42-unit stroke on 1.1 device
 * pixels — it greys out and the hook stops reading as a hook, while the
 * solid canopy above it stays crisp. Same optical correction the favicon
 * makes for the same reason; the canopy, which is what anyone recognises, is
 * never touched.
 */
export const HANDLE_STROKE = 42;
export const HANDLE_STROKE_COMPACT = 62;

/**
 * The mark at whatever `em` size the surrounding frame sets, in the current
 * text colour — so it takes the verdict tint the same way the ligatures do.
 */
export function UmbrellaMark({
  heightEm,
  strokeWidth = HANDLE_STROKE,
}: {
  heightEm: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={MARK_VIEW_BOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute bottom-0 block"
      style={{
        height: `${heightEm}em`,
        width: `${heightEm * MARK_ASPECT}em`,
        left: `${(1 - heightEm * MARK_ASPECT) / 2}em`,
      }}
    >
      {/* The ferrule, the shaft and the canopy, in the order the icon file
          draws them: the canopy paints last so it covers the shaft's top. */}
      <rect
        x={512 - strokeWidth / 2}
        y="196"
        width={strokeWidth}
        height="80"
        rx={strokeWidth / 2}
        fill="currentColor"
      />
      <path
        d={HANDLE_PATH}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path d={CANOPY_PATH} fill="currentColor" />
    </svg>
  );
}
