import * as THREE from 'three';
import type { EventKind } from '../core/types';
import { glowSprite, glowTexture } from './materials';

// Day/night, weather and sky events. Colors are keyframed by day phase and then
// blended toward event moods, so a storm at dusk looks different from one at noon.

interface Mood { top: THREE.Color; horizon: THREE.Color; sun: THREE.Color; sunI: number; hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number }

const C = (h: string) => new THREE.Color(h);
// phase keys: 0 midnight, .25 dawn, .5 noon, .75 dusk
const KEYS: [number, Mood][] = [
  [0.0, { top: C('#0b1030'), horizon: C('#2c3870'), sun: C('#9fb2ff'), sunI: 0.5, hemiSky: C('#5a6ac0'), hemiGround: C('#242a48'), hemiI: 0.75 }],
  [0.2, { top: C('#18204a'), horizon: C('#4b4a7a'), sun: C('#a0a8ff'), sunI: 0.35, hemiSky: C('#5a64a8'), hemiGround: C('#2a2a40'), hemiI: 0.6 }],
  [0.27, { top: C('#5a7fc8'), horizon: C('#ffb38a'), sun: C('#ffc48a'), sunI: 1.4, hemiSky: C('#ffd6b0'), hemiGround: C('#5a4a40'), hemiI: 0.9 }],
  [0.4, { top: C('#4aa3e8'), horizon: C('#bfe6ff'), sun: C('#fff4e0'), sunI: 2.2, hemiSky: C('#d8f0ff'), hemiGround: C('#6a7a4a'), hemiI: 1.1 }],
  [0.6, { top: C('#4aa3e8'), horizon: C('#bfe6ff'), sun: C('#fff4e0'), sunI: 2.2, hemiSky: C('#d8f0ff'), hemiGround: C('#6a7a4a'), hemiI: 1.1 }],
  [0.73, { top: C('#6a6ab8'), horizon: C('#ff9a6a'), sun: C('#ffae70'), sunI: 1.4, hemiSky: C('#ffc0a0'), hemiGround: C('#5a3a40'), hemiI: 0.85 }],
  [0.8, { top: C('#18204a'), horizon: C('#4b4a7a'), sun: C('#a0a8ff'), sunI: 0.35, hemiSky: C('#5a64a8'), hemiGround: C('#2a2a40'), hemiI: 0.6 }],
  [1.0, { top: C('#0b1030'), horizon: C('#2c3870'), sun: C('#9fb2ff'), sunI: 0.5, hemiSky: C('#5a6ac0'), hemiGround: C('#242a48'), hemiI: 0.75 }],
];

const STORM: Mood = { top: C('#3a4255'), horizon: C('#6a7385'), sun: C('#c8d0e0'), sunI: 0.5, hemiSky: C('#8a94a8'), hemiGround: C('#3a4038'), hemiI: 0.75 };
const ECLIPSE: Mood = { top: C('#1a0f3a'), horizon: C('#7a3f8a'), sun: C('#c8a8ff'), sunI: 0.45, hemiSky: C('#8a6ad8'), hemiGround: C('#2a1a40'), hemiI: 0.65 };

function lerpMood(a: Mood, b: Mood, t: number, out: Mood): Mood {
  out.top.copy(a.top).lerp(b.top, t);
  out.horizon.copy(a.horizon).lerp(b.horizon, t);
  out.sun.copy(a.sun).lerp(b.sun, t);
  out.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t);
  out.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t);
  out.sunI = a.sunI + (b.sunI - a.sunI) * t;
  out.hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;
  return out;
}

function blankMood(): Mood {
  return { top: C('#000'), horizon: C('#000'), sun: C('#000'), sunI: 0, hemiSky: C('#000'), hemiGround: C('#000'), hemiI: 0 };
}

export class Sky {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private dome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private stars: THREE.Points;
  private sunDisc: THREE.Sprite;
  private moonDisc: THREE.Mesh;
  private corona: THREE.Sprite;
  private rain: THREE.LineSegments;
  private stormClouds = new THREE.Group();
  private mood = blankMood();
  private tmp = blankMood();
  private flash = 0;
  private bolts: { mesh: THREE.Mesh; life: number }[] = [];
  private beams: { mesh: THREE.Mesh; life: number }[] = [];
  /** 0..1 how much of each event is showing (eases in/out). */
  private stormMix = 0;
  private eclipseMix = 0;
  darkness = 0;

  constructor(private scene: THREE.Scene) {
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.25,0.0,1.0); gl_FragColor = vec4(mix(horizon, top, h),1.0); }',
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 12), domeMat);
    this.group.add(this.dome);

    const starPos = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * 0.9 + 0.1;
      const r = 100;
      starPos[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * r;
      starPos[i * 3 + 1] = v * r;
      starPos[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * r;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, map: glowTexture(), transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true }));
    this.group.add(this.stars);

    this.sunDisc = glowSprite('#fff2c4', 22, 0.9);
    this.group.add(this.sunDisc);
    this.moonDisc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), new THREE.MeshBasicMaterial({ color: '#160c2a' }));
    this.group.add(this.moonDisc);
    this.corona = glowSprite('#d9c6ff', 16, 0);
    this.group.add(this.corona);

    this.hemi = new THREE.HemisphereLight('#ffffff', '#445533', 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0015;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);

    // rain
    const drops = 1100;
    const rp = new Float32Array(drops * 6);
    for (let i = 0; i < drops; i++) this.resetDrop(rp, i, Math.random() * 14);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#e4f0ff', transparent: true, opacity: 0 }));
    this.rain.frustumCulled = false;
    this.group.add(this.rain);

    const cm = new THREE.MeshToonMaterial({ color: '#5a6272', transparent: true, opacity: 0 });
    for (let i = 0; i < 14; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + Math.random() * 1.4, 1), cm);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 9;
      p.position.set(Math.cos(a) * r, 9 + Math.random() * 1.5, Math.sin(a) * r);
      p.scale.y = 0.6;
      this.stormClouds.add(p);
    }
    this.group.add(this.stormClouds);
    scene.add(this.group);
  }

  private resetDrop(arr: Float32Array, i: number, y = 14): void {
    const x = (Math.random() - 0.5) * 24;
    const z = (Math.random() - 0.5) * 24;
    arr[i * 6] = x; arr[i * 6 + 1] = y; arr[i * 6 + 2] = z;
    arr[i * 6 + 3] = x + 0.08; arr[i * 6 + 4] = y - 0.7; arr[i * 6 + 5] = z;
  }

  update(phase: number, event: EventKind | null, dt: number, time: number): void {
    // ease event visuals in and out
    const ease = (cur: number, target: number) => cur + (target - cur) * Math.min(1, dt * 0.6);
    this.stormMix = ease(this.stormMix, event === 'storm' ? 1 : 0);
    this.eclipseMix = ease(this.eclipseMix, event === 'eclipse' ? 1 : 0);

    // base mood from time of day
    let i = 0;
    while (i < KEYS.length - 2 && phase > KEYS[i + 1][0]) i++;
    const [p0, m0] = KEYS[i];
    const [p1, m1] = KEYS[i + 1];
    lerpMood(m0, m1, (phase - p0) / (p1 - p0), this.mood);
    if (this.stormMix > 0.001) lerpMood(this.mood, STORM, this.stormMix * 0.85, this.tmp), this.copyMood(this.tmp);
    if (this.eclipseMix > 0.001) lerpMood(this.mood, ECLIPSE, this.eclipseMix * 0.9, this.tmp), this.copyMood(this.tmp);

    const m = this.mood;
    this.dome.material.uniforms.top.value.copy(m.top);
    this.dome.material.uniforms.horizon.value.copy(m.horizon);
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.copy(m.horizon);
    this.hemi.color.copy(m.hemiSky);
    this.hemi.groundColor.copy(m.hemiGround);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.hemi.intensity = m.hemiI + this.flash * 2.5;
    this.sun.color.copy(m.sun);
    this.sun.intensity = m.sunI;

    // sun travels across the sky by day; at night the "sun" light is the moon
    const day = phase > 0.22 && phase < 0.78;
    const a = day ? ((phase - 0.22) / 0.56) * Math.PI : ((phase + (phase < 0.5 ? 1 : 0) - 0.78) / 0.44) * Math.PI;
    const dir = new THREE.Vector3(Math.cos(a) * 14, Math.max(4, Math.sin(a) * 18), 6);
    this.sun.position.copy(dir);
    this.sun.target.position.set(0, 0, 0);
    const sky = dir.clone().normalize().multiplyScalar(90);
    this.sunDisc.position.copy(sky);
    (this.sunDisc.material as THREE.SpriteMaterial).color.set(day ? '#fff2c4' : '#dfe6ff');
    this.sunDisc.scale.setScalar(day ? 22 : 12);
    // eclipse: the moon slides over the sun
    this.moonDisc.position.copy(sky).multiplyScalar(0.98).add(new THREE.Vector3((1 - this.eclipseMix) * 8, 0, 0));
    this.moonDisc.lookAt(0, 0, 0);
    this.moonDisc.visible = this.eclipseMix > 0.02;
    this.corona.position.copy(sky).multiplyScalar(0.97);
    (this.corona.material as THREE.SpriteMaterial).opacity = this.eclipseMix * (0.7 + Math.sin(time * 2) * 0.1);
    (this.sunDisc.material as THREE.SpriteMaterial).opacity = 0.9 * (1 - this.stormMix * 0.9);

    this.darkness = Math.max(1 - Math.min(1, (m.sunI - 0.5) / 1.1), this.eclipseMix * 0.85);
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, this.darkness - 0.3) * (1 - this.stormMix);
    this.stars.rotation.y = time * 0.005;

    // rain
    const rm = this.rain.material as THREE.LineBasicMaterial;
    rm.opacity = this.stormMix * 0.85;
    if (this.stormMix > 0.02) {
      const arr = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
      const pa = arr.array as Float32Array;
      const fall = dt * 16;
      for (let k = 0; k < pa.length / 6; k++) {
        pa[k * 6 + 1] -= fall; pa[k * 6 + 4] -= fall;
        pa[k * 6] += dt * 1.2; pa[k * 6 + 3] += dt * 1.2;
        if (pa[k * 6 + 4] < 0) this.resetDrop(pa, k);
      }
      arr.needsUpdate = true;
      if (Math.random() < dt * 0.12) this.flash = 1;
    }
    const cmat = (this.stormClouds.children[0] as THREE.Mesh).material as THREE.MeshToonMaterial;
    cmat.opacity = this.stormMix * 0.92;
    this.stormClouds.visible = this.stormMix > 0.01;
    this.stormClouds.rotation.y += dt * 0.03;

    for (const b of this.bolts) {
      b.life -= dt;
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, b.life * 3);
    }
    this.bolts = this.bolts.filter((b) => (b.life > 0 ? true : (this.group.remove(b.mesh), b.mesh.geometry.dispose(), false)));
    for (const b of this.beams) {
      b.life -= dt;
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.5, b.life * 0.3);
    }
    this.beams = this.beams.filter((b) => (b.life > 0 ? true : (this.group.remove(b.mesh), b.mesh.geometry.dispose(), false)));
  }

  private copyMood(src: Mood): void {
    lerpMood(src, src, 0, this.mood);
  }

  /** Sparkfall: a jagged bolt from the clouds to a point. */
  strike(target: THREE.Vector3): void {
    const pts: THREE.Vector3[] = [];
    const top = new THREE.Vector3(target.x + (Math.random() - 0.5) * 2, 10, target.z + (Math.random() - 0.5) * 2);
    for (let i = 0; i <= 8; i++) {
      const p = top.clone().lerp(target, i / 8);
      if (i > 0 && i < 8) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8));
      pts.push(p);
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 24, 0.06, 4, false);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#fff6a8', transparent: true, opacity: 1 }));
    this.group.add(mesh);
    this.bolts.push({ mesh, life: 0.45 });
    this.flash = 1.2;
  }

  /** Moonbeam: a soft column of light onto a creature during an eclipse. */
  moonbeam(target: THREE.Vector3): void {
    const geo = new THREE.CylinderGeometry(0.5, 1.1, 12, 16, 1, true);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: '#d4dcff', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    mesh.position.set(target.x, 6, target.z);
    this.group.add(mesh);
    this.beams.push({ mesh, life: 5 });
  }
}
