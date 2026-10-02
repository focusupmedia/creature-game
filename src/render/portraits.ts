import * as THREE from 'three';
import type { MutationId, SpeciesId } from '../core/types';
import { animateGlow, buildCreature, disposeCreature } from './creatureModels';

// Renders small creature portraits for UI lists and the journal, using the main
// renderer and an offscreen target. Results are cached as data URLs.

export class Portraits {
  private cache = new Map<string, string>();
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private rt = new THREE.WebGLRenderTarget(128, 128);
  private canvas = document.createElement('canvas');

  constructor(private renderer: THREE.WebGLRenderer) {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#667788', 1.6));
    const d = new THREE.DirectionalLight('#ffffff', 1.6);
    d.position.set(2, 3, 4);
    this.scene.add(d);
    this.canvas.width = this.canvas.height = 128;
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
  }

  get(species: SpeciesId, mutations: MutationId[], silhouette = false): string {
    const key = `${species}|${mutations.join(',')}|${silhouette}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const model = buildCreature(species, mutations, 500);
    animateGlow(model, 0.65);
    model.root.scale.setScalar(1);
    model.root.rotation.y = -0.5;
    if (silhouette) {
      model.root.traverse((o) => {
        if (o instanceof THREE.Mesh) o.material = new THREE.MeshBasicMaterial({ color: '#2a3350' });
        if (o instanceof THREE.Sprite) o.visible = false;
      });
    }
    // Additive glow sprites read as dark smudges on a transparent portrait,
    // and would shrink the framing: hide them; the glowing rim still shows.
    model.root.traverse((o) => {
      if (o instanceof THREE.Sprite) o.visible = false;
    });
    model.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    model.root.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.outline) box.expandByObject(o);
    });
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z) * 0.62;
    this.camera.position.set(center.x, center.y + r * 0.6, center.z + r * 3.3);
    this.camera.lookAt(center);
    this.scene.add(model.root);
    const prevTarget = this.renderer.getRenderTarget();
    const prevClear = this.renderer.getClearAlpha();
    this.renderer.setRenderTarget(this.rt);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    const px = new Uint8Array(128 * 128 * 4);
    this.renderer.readRenderTargetPixels(this.rt, 0, 0, 128, 128, px);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearAlpha(prevClear);
    this.scene.remove(model.root);
    disposeCreature(model);
    const g = this.canvas.getContext('2d')!;
    const img = g.createImageData(128, 128);
    // flip Y
    for (let y = 0; y < 128; y++) img.data.set(px.subarray((127 - y) * 512, (128 - y) * 512), y * 512);
    g.clearRect(0, 0, 128, 128);
    g.putImageData(img, 0, 0);
    const url = this.canvas.toDataURL('image/png');
    this.cache.set(key, url);
    return url;
  }
}
