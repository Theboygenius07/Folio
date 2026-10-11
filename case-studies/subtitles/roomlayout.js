/* Where every photo hangs in the gallery, Subtitles/views/gallery.js:5-26 and 93-117.
   Shared by the corridor (Fig. 8) and the small drawing of it in Fig. 3. */
export const ROOM_W = 14, ROOM_H = 5.5, ROOM_D = 110;
export const HANG_Y = 1.55, EYE_Y = 1.70;
export const WALL_X = ROOM_W / 2, PHOTO_X = WALL_X - 0.12, ASPECT = 16 / 9;

/* gallery.js:18-26: 5 sizes, picked by a sine of the photo's index */
export function photoHeight(i) {
  const r = (Math.sin(i * 7.3219 + 1.618) + 1) / 2;
  if (r < 0.22) return 0.68;
  if (r < 0.52) return 0.95;
  if (r < 0.76) return 1.25;
  if (r < 0.93) return 1.60;
  return 1.95;
}

export function layoutPhotos(photos) {
  const SPREAD = ROOM_D - 6;
  const wallCount = Math.ceil(photos.length / 2);
  return photos.map((photo, i) => {
    const h = photoHeight(i), w = h * ASPECT;
    const side = i % 2 === 0 ? -1 : 1;                       // even on the left wall
    const t = wallCount > 1 ? Math.floor(i / 2) / (wallCount - 1) : 0;
    const z = ROOM_D / 2 - 3 - t * SPREAD + Math.sin(i * 2.618) * 0.30;
    const y = HANG_Y + Math.sin(i * 1.414) * 0.12;
    return { photo, i, h, w, side, x: side * PHOTO_X, y, z };
  });
}
