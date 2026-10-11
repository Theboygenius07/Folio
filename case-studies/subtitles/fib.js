/* The globe's placement, Subtitles/views/globe.js:52-57: point i of 80 on a sphere of
   radius 6. phi steps the height evenly from pole to pole; theta winds round it. */
export const R = 6, COUNT = 80;
const ROOT = Math.sqrt(COUNT * Math.PI);
export function fib(i, count = COUNT, r = R) {
  const phi = Math.acos(-1 + (2 * i) / count);
  const theta = (count === COUNT ? ROOT : Math.sqrt(count * Math.PI)) * phi;
  return {
    phi, theta,
    x: r * Math.cos(theta) * Math.sin(phi),
    y: r * Math.sin(theta) * Math.sin(phi),
    z: r * Math.cos(phi),
  };
}
