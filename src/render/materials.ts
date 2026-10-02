import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// A shared 3-band toon ramp gives everything the same soft, illustrated look
// and keeps shader variants (and mobile compile hitches) to a minimum.
let ramp: THREE.DataTexture | null = null;
export function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp;
  // Bright, toy-like ramp: soft shadow band, no muddy darks.
  const data = new Uint8Array([150, 150, 150, 255, 210, 210, 210, 255, 255, 255, 255, 255]);
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

// ---------------------------------------------------------------- toy-box outlines
// Inverted-hull outlines: a slightly inflated, back-face-only copy of a mesh drawn
// in navy. Inflation happens in view space so the line weight is even regardless
// of how a part is scaled. Faceted geometry gets smoothed normals for the hull so
// hard edges don't crack.

const OUTLINE_COLOR = new THREE.Color('#1b2a4a');
const outlineMats = new Map<number, THREE.ShaderMaterial>();

/** `thickness` is the outline width in (approximate) screen pixels. */
export function outlineMaterial(thickness = 3): THREE.ShaderMaterial {
  let m = outlineMats.get(thickness);
  if (!m) {
    m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { color: { value: OUTLINE_COLOR }, thickness: { value: thickness } },
      vertexShader: `uniform float thickness;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * normal);
          // thickness is roughly in screen pixels: scale the offset with view distance
          mv.xyz += n * thickness * max(-mv.z, 1.0) * 0.0012;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }`,
    });
    outlineMats.set(thickness, m);
  }
  return m;
}

/** A per-creature outline whose color can pulse: the "glowy" rim of rare mutations. */
export function glowOutlineMaterial(color: THREE.Color, thickness: number): THREE.ShaderMaterial {
  const base = outlineMaterial(thickness);
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { color: { value: color.clone() }, thickness: { value: thickness } },
    vertexShader: base.vertexShader,
    fragmentShader: base.fragmentShader,
  });
}

const hullCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

function hullGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  let hull = hullCache.get(geo);
  if (hull) return hull;
  const base = new THREE.BufferGeometry();
  base.setAttribute('position', geo.getAttribute('position'));
  if (geo.index) base.setIndex(geo.index);
  hull = mergeVertices(base, 1e-3);
  hull.computeVertexNormals();
  hullCache.set(geo, hull);
  return hull;
}

/** Give every solid mesh under `root` a navy outline. Skips sprites, hit boxes and transparent effects. */
export function addOutlines(root: THREE.Object3D, thickness = 3): void {
  const targets: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.outline || o.userData.noOutline) return;
    const mat = o.material as THREE.Material;
    if (!mat || mat.visible === false || mat.transparent || mat instanceof THREE.ShaderMaterial) return;
    targets.push(o);
  });
  for (const o of targets) {
    const hull = new THREE.Mesh(hullGeometry(o.geometry), outlineMaterial(thickness));
    hull.userData.outline = true;
    hull.castShadow = false;
    hull.receiveShadow = false;
    hull.raycast = () => {};
    o.add(hull);
  }
}
