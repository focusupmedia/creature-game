// Islands are little planets. The game still thinks in flat map coordinates
// (x, z) on each island's disc, which keeps the simulation and layouts simple;
// this module wraps that disc around a sphere so nothing has an edge.
//
// The wrap is an equal-area (Lambert azimuthal) projection: the disc centre is
// the top of the globe and the disc rim is the bottom pole, and equal areas on
// the map stay equal on the globe, so things spread evenly all the way round.
// Near the top it is nearly undistorted, so buildings keep their shapes.

import type { Geo } from './islands';

export interface V3 { x: number; y: number; z: number }

/**
 * Globe size. A sphere of radius r / 2 would match the map's area exactly;
 * a bit bigger reads better (buildings and creatures look small on a big
 * world), so the map is scaled up by GLOBE_SCALE as it wraps.
 */
export const GLOBE_SCALE = 2;

export function globeRadius(g: Pick<Geo, 'r'>): number {
  return (g.r / 2) * GLOBE_SCALE;
}

/** Centre of the globe; its top sits at height 0, where the old flat islands were. */
export function globeCenter(g: Pick<Geo, 'ox' | 'oz' | 'r'>): V3 {
  return { x: g.ox, y: -globeRadius(g), z: g.oz };
}

/** How far out from the top a map point is: 0 at the top, 1 at the bottom pole. */
export function globeS(g: Pick<Geo, 'ox' | 'oz' | 'r'>, x: number, z: number): number {
  return Math.min(1, Math.hypot(x - g.ox, z - g.oz) / g.r);
}

/** Surface normal (unit vector from the globe centre) under a map point. */
export function globeNormal(g: Pick<Geo, 'ox' | 'oz' | 'r'>, x: number, z: number): V3 {
  const u = x - g.ox;
  const v = z - g.oz;
  const d = Math.hypot(u, v);
  if (d < 1e-6) return { x: 0, y: 1, z: 0 };
  const s = Math.min(1, d / g.r);
  const theta = 2 * Math.asin(s);
  const k = Math.sin(theta) / d;
  return { x: u * k, y: Math.cos(theta), z: v * k };
}

/** World position of a map point, `alt` units above the surface. */
export function globePoint(g: Pick<Geo, 'ox' | 'oz' | 'r'>, x: number, z: number, alt = 0): V3 {
  const n = globeNormal(g, x, z);
  const c = globeCenter(g);
  const R = globeRadius(g) + alt;
  return { x: c.x + n.x * R, y: c.y + n.y * R, z: c.z + n.z * R };
}

/** Back from a direction (from the globe centre) to the map point under it. */
export function globeToMap(g: Pick<Geo, 'ox' | 'oz' | 'r'>, n: V3): { x: number; z: number } {
  const len = Math.hypot(n.x, n.y, n.z) || 1;
  const ny = Math.max(-1, Math.min(1, n.y / len));
  const theta = Math.acos(ny);
  const d = Math.sin(theta / 2) * g.r;
  const h = Math.hypot(n.x, n.z);
  if (h < 1e-9) return { x: g.ox, z: g.oz + (ny < 0 ? d : 0) };
  return { x: g.ox + (n.x / h) * d, z: g.oz + (n.z / h) * d };
}

/**
 * Map-space step that covers `len` units of real distance on the globe in
 * the direction (dx, dz). The wrap stretches radial moves and squeezes
 * sideways ones toward the bottom; this keeps walking speed even everywhere.
 */
export function globeStep(g: Pick<Geo, 'ox' | 'oz' | 'r'>, x: number, z: number, dx: number, dz: number): number {
  const u = x - g.ox;
  const v = z - g.oz;
  const d = Math.hypot(u, v);
  const len = Math.hypot(dx, dz) || 1;
  if (d < 1e-6) return 1;
  const s = Math.min(0.995, d / g.r);
  const c = Math.sqrt(1 - s * s);
  const a = (dx * u + dz * v) / (d * len);
  const b = (dz * u - dx * v) / (d * len);
  return 1 / (GLOBE_SCALE * Math.hypot(a / c, b * c));
}
