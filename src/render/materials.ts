import * as THREE from 'three';

// A shared 3-band toon ramp gives everything the same soft, illustrated look
// and keeps shader variants (and mobile compile hitches) to a minimum.
let ramp: THREE.DataTexture | null = null;
export function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp;
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

const cache = new Map<string, THREE.MeshToonMaterial>();

/** Shared toon material per color. Never mutate a shared material; use `uniqueToon` for animated ones. */
export function toon(color: string | number, emissive?: string | number, emissiveIntensity = 1): THREE.MeshToonMaterial {
  const key = `${color}|${emissive ?? ''}|${emissiveIntensity}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp() });
    if (emissive !== undefined) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = emissiveIntensity;
    }
    cache.set(key, m);
  }
  return m;
}

export function uniqueToon(color: string | number, opts: Partial<THREE.MeshToonMaterialParameters> = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...opts });
}

/** Vertex-colored toon material for merged static scenery. */
let vc: THREE.MeshToonMaterial | null = null;
export function vertexToon(): THREE.MeshToonMaterial {
  if (!vc) vc = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
  return vc;
}

const glowTextures = new Map<string, THREE.Texture>();
/** Soft radial sprite used for glows, fireflies, sparkles and halos. */
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)'): THREE.Texture {
  const key = inner + outer;
  const hit = glowTextures.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  glowTextures.set(key, tex);
  return tex;
}

export function glowSprite(color: string, size: number, opacity = 0.8): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  return s;
}

/** Emoji/text sprite for emotes (hearts, notes, Zzz, "!"). */
const emoteCache = new Map<string, THREE.Texture>();
export function emoteTexture(text: string): THREE.Texture {
  const hit = emoteCache.get(text);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.font = '92px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  emoteCache.set(text, tex);
  return tex;
}
