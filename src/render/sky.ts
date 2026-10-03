import * as THREE from 'three';
import type { EventKind } from '../core/types';
import { glowSprite, glowTexture } from './materials';

// Day/night, weather and sky events. Colors are keyframed by day phase and then
// blended toward each event's mood, so a storm at dusk looks different from one at noon.
//
// Note on placement: the diorama camera looks down at the island, so the only
// sky the player sees is the band *behind* the island (below the true horizon).
// Event showpieces (eclipse, full moon, falling stars, storm clouds) live there.

interface Mood { top: THREE.Color; horizon: THREE.Color; low: THREE.Color; sun: THREE.Color; sunI: number; hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number }

const C = (h: string) => new THREE.Color(h);
const M = (top: string, horizon: string, low: string, sun: string, sunI: number, hemiSky: string, hemiGround: string, hemiI: number): Mood =>
  ({ top: C(top), horizon: C(horizon), low: C(low), sun: C(sun), sunI, hemiSky: C(hemiSky), hemiGround: C(hemiGround), hemiI });

// phase keys: 0 midnight, .25 dawn, .5 noon, .75 dusk. Toy-box palette: bright, saturated days.
const NIGHT = M('#0b1238', '#2c3a80', '#3a4ea0', '#a8b8ff', 0.55, '#6070d0', '#262c50', 0.8);
const KEYS: [number, Mood][] = [
  [0.0, NIGHT],
  [0.2, M('#18204a', '#4b4a8a', '#5a5aa0', '#a0a8ff', 0.45, '#5a64a8', '#2a2a40', 0.65)],
  [0.27, M('#4f86e0', '#ffb38a', '#ffcf9a', '#ffc48a', 1.5, '#ffd6b0', '#5a4a40', 0.95)],
  [0.4, M('#2f8ff0', '#9fe0ff', '#7fd0ff', '#fff6e6', 2.3, '#e0f4ff', '#6a8a4a', 1.2)],
  [0.6, M('#2f8ff0', '#9fe0ff', '#7fd0ff', '#fff6e6', 2.3, '#e0f4ff', '#6a8a4a', 1.2)],
  [0.73, M('#5a62c8', '#ff9a6a', '#ffb07a', '#ffae70', 1.5, '#ffc0a0', '#5a3a40', 0.9)],
  [0.8, M('#18204a', '#4b4a8a', '#5a5aa0', '#a0a8ff', 0.45, '#5a64a8', '#2a2a40', 0.65)],
  [1.0, NIGHT],
];

const MOODS: Record<EventKind, { mood: Mood; strength: number; darkness: number }> = {
  storm: { mood: M('#3a4560', '#6a7890', '#56627a', '#c8d0e0', 0.6, '#9aa4b8', '#3a4038', 0.85), strength: 0.85, darkness: 0 },
  eclipse: { mood: M('#1a0f3a', '#7a3f9a', '#5a2f8a', '#c8a8ff', 0.5, '#8a6ad8', '#2a1a40', 0.7), strength: 0.9, darkness: 0.85 },
  starry: { mood: M('#060828', '#1e2468', '#2a2f80', '#b8c4ff', 0.55, '#6a6ad0', '#20204a', 0.85), strength: 0.95, darkness: 0.85 },
  fullmoon: { mood: M('#0e1a40', '#3a5694', '#4a66a8', '#eef2ff', 1.1, '#a8bcff', '#2a3458', 1.0), strength: 0.95, darkness: 0.65 },
  blizzard: { mood: M('#9fb0c8', '#e4ecf6', '#d6e0ee', '#f4f8ff', 1.2, '#eef4ff', '#8494a8', 1.2), strength: 0.9, darkness: 0 },
  rainbow: { mood: M('#48a6ff', '#cdeeff', '#a8e2ff', '#fff4d6', 2.4, '#f0faff', '#6a8a4a', 1.25), strength: 0.6, darkness: 0 },
  aurora: { mood: M('#04122a', '#123c52', '#1a3a5a', '#b8ffe6', 0.6, '#6ad8b8', '#1a2a3a', 0.85), strength: 0.95, darkness: 0.8 },
  meteor: { mood: M('#0a0a30', '#2a2060', '#33307a', '#ffd8b8', 0.55, '#8a70d0', '#22203a', 0.85), strength: 0.95, darkness: 0.85 },
  fog: { mood: M('#b8c4cc', '#dde4ea', '#d0d8e0', '#f2f4f6', 1.1, '#e8eef2', '#8a9490', 1.1), strength: 0.85, darkness: 0.1 },
};

const RAINBOW = ['#ff4a4a', '#ff9a2a', '#ffe23a', '#5ad64a', '#3aa8ff', '#5a5aff', '#b05aff'];

function lerpMood(a: Mood, b: Mood, t: number, out: Mood): Mood {
  out.top.copy(a.top).lerp(b.top, t);
  out.horizon.copy(a.horizon).lerp(b.horizon, t);
  out.low.copy(a.low).lerp(b.low, t);
  out.sun.copy(a.sun).lerp(b.sun, t);
  out.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t);
  out.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t);
  out.sunI = a.sunI + (b.sunI - a.sunI) * t;
  out.hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;
  return out;
}

const blankMood = () => M('#000', '#000', '#000', '#000', 0, '#000', '#000', 0);

/** Where event showpieces sit: behind the island, in the slice of sky the camera can see. */
const SHOWCASE = new THREE.Vector3(0.04, -0.6, -1).normalize().multiplyScalar(85);

interface Fx { obj: THREE.Object3D; life: number; max: number; update?: (k: number, dt: number) => void }

export class Sky {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private dome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private stars: THREE.Points;
  private sunDisc: THREE.Sprite;
  private eclipseSun: THREE.Sprite;
  private moonDisc: THREE.Mesh;
  private corona: THREE.Sprite;
  private fullMoon: THREE.Sprite;
  private fullMoonGlow: THREE.Sprite;
  private rain: THREE.LineSegments;
  private snow: THREE.Points;
  private clouds = new THREE.Group();
  private cloudMat: THREE.MeshToonMaterial;
  private mood = blankMood();
  private tmp = blankMood();
  private flash = 0;
  private fx: Fx[] = [];
  private shootTimer = 0;
  /** 0..1 how much of each event is showing (eases in/out). */
  private mix: Record<EventKind, number> = { storm: 0, eclipse: 0, starry: 0, fullmoon: 0, blizzard: 0, rainbow: 0, aurora: 0, meteor: 0, fog: 0 };
  private rainbow = new THREE.Group();
  private rainbowMats: THREE.MeshBasicMaterial[] = [];
  private aurora = new THREE.Group();
  private auroraMats: THREE.MeshBasicMaterial[] = [];
  darkness = 0;

  constructor(private scene: THREE.Scene) {
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, low: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 low; varying vec3 vP;
        void main(){
          float up = clamp(vP.y * 1.4 + 0.1, 0.0, 1.0);
          float down = clamp(-vP.y * 1.6, 0.0, 1.0);
          vec3 c = vP.y >= 0.0 ? mix(horizon, top, up) : mix(horizon, low, down);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), domeMat);
    this.group.add(this.dome);

    // stars wrap the whole dome, including the band behind the island
    const n = 700;
    const starPos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * 1.6 - 0.75;
      const r = 100;
      starPos[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * r;
      starPos[i * 3 + 1] = v * r;
      starPos[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * r;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: '#ffffff', size: 1.6, map: glowTexture(), transparent: true, opacity: 0, depthWrite: false, fog: false,
    }));
    this.group.add(this.stars);

    const noFog = (s: THREE.Sprite) => {
      (s.material as THREE.SpriteMaterial).fog = false;
      return s;
    };
    this.sunDisc = noFog(glowSprite('#fff2c4', 22, 0.9));
    this.group.add(this.sunDisc);

    // eclipse showpiece: a sun, a dark moon sliding over it, and a corona
    this.eclipseSun = noFog(glowSprite('#fff2c4', 20, 0));
    this.eclipseSun.position.copy(SHOWCASE);
    this.moonDisc = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), new THREE.MeshBasicMaterial({ color: '#160c2a', fog: false }));
    this.moonDisc.lookAt(0, 0, 0);
    this.corona = noFog(glowSprite('#d9c6ff', 18, 0));
    this.corona.position.copy(SHOWCASE).multiplyScalar(1.01);
    this.group.add(this.eclipseSun, this.corona, this.moonDisc);

    // full moon showpiece
    this.fullMoonGlow = noFog(glowSprite('#cfe0ff', 34, 0));
    this.fullMoonGlow.position.copy(SHOWCASE).multiplyScalar(1.01);
    const moonTex = new THREE.CanvasTexture(moonCanvas());
    moonTex.colorSpace = THREE.SRGBColorSpace;
    this.fullMoon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.fullMoon.scale.setScalar(13);
    this.fullMoon.position.copy(SHOWCASE);
    this.group.add(this.fullMoonGlow, this.fullMoon);

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

    // snow
    const flakes = 900;
    const sp = new Float32Array(flakes * 3);
    for (let i = 0; i < flakes; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 26;
      sp[i * 3 + 1] = Math.random() * 14;
      sp[i * 3 + 2] = (Math.random() - 0.5) * 26;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
      color: '#ffffff', size: 0.22, map: glowTexture(), transparent: true, opacity: 0, depthWrite: false,
    }));
    this.snow.frustumCulled = false;
    this.group.add(this.snow);

    // weather clouds: a ring on the horizon behind and around the island, never between camera and island
    this.cloudMat = new THREE.MeshToonMaterial({ color: '#5a6272', transparent: true, opacity: 0, fog: false });
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
      const r = 30 + Math.random() * 14;
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + Math.random() * 3, 1), this.cloudMat);
      puff.position.set(Math.cos(a) * r, -6 + Math.random() * 10, Math.sin(a) * r);
      puff.scale.y = 0.55;
      this.clouds.add(puff);
    }
    this.clouds.visible = false;
    this.group.add(this.clouds);

    // rainbow: seven bands arcing behind the island
    RAINBOW.forEach((col, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, fog: false, depthWrite: false, side: THREE.DoubleSide });
      this.rainbowMats.push(mat);
      this.rainbow.add(new THREE.Mesh(new THREE.TorusGeometry(44 - i * 1.6, 0.85, 6, 64, Math.PI), mat));
    });
    this.rainbow.position.copy(SHOWCASE).setY(SHOWCASE.y - 22);
    this.rainbow.lookAt(0, this.rainbow.position.y, 0);
    this.rainbow.visible = false;
    this.group.add(this.rainbow);

    // aurora: rippling curtains of green and violet light
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.PlaneGeometry(110, 14, 48, 1);
      const cols: number[] = [];
      const pos = geo.getAttribute('position');
      for (let v = 0; v < pos.count; v++) {
        const top = pos.getY(v) > 0;
        const c = top ? C(i % 2 ? '#b07aff' : '#4affc8') : C('#1aff9a');
        cols.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      geo.userData.base = Float32Array.from(pos.array as Float32Array);
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      });
      this.auroraMats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      // in the band of sky behind the island, where the camera can see it
      mesh.position.copy(SHOWCASE).add(new THREE.Vector3((i - 1.5) * 16, 14 + i * 5, -i * 4));
      mesh.lookAt(0, mesh.position.y, 0);
      this.aurora.add(mesh);
    }
    this.aurora.visible = false;
    this.group.add(this.aurora);
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
    for (const k of Object.keys(this.mix) as EventKind[]) {
      this.mix[k] += ((event === k ? 1 : 0) - this.mix[k]) * Math.min(1, dt * 0.6);
    }
    const mx = this.mix;

    // base mood from time of day, then each event's mood on top
    let i = 0;
    while (i < KEYS.length - 2 && phase > KEYS[i + 1][0]) i++;
    const [p0, m0] = KEYS[i];
    const [p1, m1] = KEYS[i + 1];
    lerpMood(m0, m1, (phase - p0) / (p1 - p0), this.mood);
    let eventDark = 0;
    for (const k of Object.keys(MOODS) as EventKind[]) {
      if (mx[k] < 0.001) continue;
      lerpMood(this.mood, MOODS[k].mood, mx[k] * MOODS[k].strength, this.tmp);
      lerpMood(this.tmp, this.tmp, 0, this.mood);
      eventDark = Math.max(eventDark, mx[k] * MOODS[k].darkness);
    }

    const m = this.mood;
    const u = this.dome.material.uniforms;
    u.top.value.copy(m.top);
    u.horizon.value.copy(m.horizon);
    u.low.value.copy(m.low);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(m.horizon);
      // a blizzard pulls the fog in close
      // ...and a magic fog pulls it in closer still
      this.scene.fog.near = 45 - mx.blizzard * 22 - mx.fog * 24;
      this.scene.fog.far = 110 - mx.blizzard * 55 - mx.fog * 60;
    }
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
    this.sunDisc.position.copy(dir.clone().normalize().multiplyScalar(90));
    (this.sunDisc.material as THREE.SpriteMaterial).color.set(day ? '#fff2c4' : '#dfe6ff');
    (this.sunDisc.material as THREE.SpriteMaterial).opacity = 0.9 * (1 - Math.max(mx.storm, mx.blizzard) * 0.9);

    // eclipse: the moon slides across the sun
    const e = mx.eclipse;
    (this.eclipseSun.material as THREE.SpriteMaterial).opacity = e * 0.95;
    this.moonDisc.visible = e > 0.02;
    this.moonDisc.position.copy(SHOWCASE).multiplyScalar(0.98).add(new THREE.Vector3((1 - e) * 9, 0, 0));
    (this.corona.material as THREE.SpriteMaterial).opacity = e * (0.75 + Math.sin(time * 2) * 0.1);

    // full moon rises behind the island
    const fm = mx.fullmoon;
    (this.fullMoon.material as THREE.SpriteMaterial).opacity = fm;
    this.fullMoon.position.copy(SHOWCASE).add(new THREE.Vector3(0, (1 - fm) * -10, 0));
    (this.fullMoonGlow.material as THREE.SpriteMaterial).opacity = fm * (0.55 + Math.sin(time * 1.5) * 0.08);
    this.fullMoonGlow.position.copy(this.fullMoon.position);

    this.darkness = Math.max(1 - Math.min(1, (m.sunI - 0.55) / 1.1), eventDark);
    const sm = this.stars.material as THREE.PointsMaterial;
    sm.opacity = Math.min(1, Math.max(0, this.darkness - 0.3) * (1 - mx.storm) * (1 - mx.blizzard) * (1 - mx.fog) + mx.starry * 0.6 + mx.meteor * 0.4);
    sm.size = 1.6 + mx.starry * 1.2 + Math.sin(time * 3) * 0.15 * mx.starry;
    this.stars.rotation.y = time * 0.005;

    // falling stars streak across the visible sky on a Starry Night
    this.shootTimer -= dt;
    if (mx.starry > 0.5 && this.shootTimer <= 0) {
      this.shootTimer = 0.6 + Math.random() * 1.6;
      this.shootingStar();
    }
    // a meteor shower: lots of them, warm and colourful
    if (mx.meteor > 0.4 && this.shootTimer <= 0) {
      this.shootTimer = 0.12 + Math.random() * 0.4;
      this.shootingStar(Math.random() < 0.5 ? '#ffd28a' : Math.random() < 0.5 ? '#ff9ad8' : '#9ae6ff');
    }

    // rainbow
    this.rainbow.visible = mx.rainbow > 0.01;
    for (const mat of this.rainbowMats) mat.opacity = mx.rainbow * 0.55;

    // aurora curtains ripple slowly
    this.aurora.visible = mx.aurora > 0.01;
    if (this.aurora.visible) {
      this.aurora.children.forEach((ch, i) => {
        const mesh = ch as THREE.Mesh;
        const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const base = mesh.geometry.userData.base as Float32Array;
        for (let v = 0; v < pos.count; v++) {
          const x = base[v * 3];
          pos.setZ(v, Math.sin(x * 0.08 + time * 0.6 + i) * 5 + Math.sin(x * 0.21 - time * 0.4) * 2);
          pos.setY(v, base[v * 3 + 1] + Math.sin(x * 0.05 + time * 0.3 + i * 2) * 3);
        }
        pos.needsUpdate = true;
        this.auroraMats[i].opacity = mx.aurora * (0.28 + Math.sin(time * 0.8 + i * 1.7) * 0.1);
      });
    }

    // rain
    const rm = this.rain.material as THREE.LineBasicMaterial;
    rm.opacity = mx.storm * 0.85;
    if (mx.storm > 0.02) {
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

    // snow
    (this.snow.material as THREE.PointsMaterial).opacity = mx.blizzard * 0.95;
    if (mx.blizzard > 0.02) {
      const arr = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
      const pa = arr.array as Float32Array;
      for (let k = 0; k < pa.length / 3; k++) {
        pa[k * 3 + 1] -= dt * (1.6 + (k % 5) * 0.25);
        pa[k * 3] += dt * (2.2 + Math.sin(time + k) * 0.8);
        pa[k * 3 + 2] += Math.cos(time * 0.7 + k) * dt * 0.4;
        if (pa[k * 3 + 1] < 0) {
          pa[k * 3 + 1] = 14;
          pa[k * 3] = (Math.random() - 0.5) * 26 - 4;
        }
        if (pa[k * 3] > 13) pa[k * 3] -= 26;
      }
      arr.needsUpdate = true;
    }

    // horizon clouds: dark for storms, white for blizzards
    const cloudAmt = Math.max(mx.storm, mx.blizzard, mx.fog * 0.8);
    this.clouds.visible = cloudAmt > 0.01;
    this.cloudMat.opacity = cloudAmt * 0.95;
    this.cloudMat.color.set('#5a6272').lerp(C('#f2f6ff'), Math.max(mx.blizzard, mx.fog) / Math.max(0.001, cloudAmt));
    this.clouds.rotation.y = Math.sin(time * 0.02) * 0.15;

    for (const f of this.fx) {
      f.life -= dt;
      f.update?.(1 - Math.max(0, f.life) / f.max, dt);
    }
    this.fx = this.fx.filter((f) => {
      if (f.life > 0) return true;
      this.group.remove(f.obj);
      f.obj.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) o.geometry.dispose();
      });
      return false;
    });
  }

  private add(obj: THREE.Object3D, life: number, update?: Fx['update']): void {
    this.group.add(obj);
    this.fx.push({ obj, life, max: life, update });
  }

  private shootingStar(color = '#fff6c8'): void {
    const start = SHOWCASE.clone().add(new THREE.Vector3((Math.random() - 0.5) * 70, 10 + Math.random() * 18, (Math.random() - 0.5) * 10));
    const dir = new THREE.Vector3(-0.8 - Math.random() * 0.4, -0.5, 0).normalize();
    const geo = new THREE.BufferGeometry().setFromPoints([start, start.clone().addScaledVector(dir, 9)]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, fog: false });
    const line = new THREE.Line(geo, mat);
    this.add(line, 0.7, (k) => {
      line.position.copy(dir).multiplyScalar(k * 22);
      mat.opacity = 1 - k;
    });
  }

  /** Sparkfall: a jagged bolt from the clouds to a point. */
  strike(target: THREE.Vector3): void {
    const pts: THREE.Vector3[] = [];
    const top = new THREE.Vector3(target.x + (Math.random() - 0.5) * 2, 14, target.z - 4);
    for (let i = 0; i <= 8; i++) {
      const p = top.clone().lerp(target, i / 8);
      if (i > 0 && i < 8) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8));
      pts.push(p);
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 24, 0.06, 4, false);
    const mat = new THREE.MeshBasicMaterial({ color: '#fff6a8', transparent: true, opacity: 1 });
    this.add(new THREE.Mesh(geo, mat), 0.45, (k) => (mat.opacity = 1 - k));
    this.flash = 1.2;
  }

  /** Moonbeam: a soft column of light onto a creature (eclipse, full moon). */
  moonbeam(target: THREE.Vector3): void {
    const geo = new THREE.CylinderGeometry(0.5, 1.1, 12, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: '#d4dcff', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(target.x, 6, target.z);
    this.add(mesh, 5, (k) => (mat.opacity = Math.min(0.5, (1 - k) * 1.5)));
  }

  /** A falling star drops onto a creature; `onLand` fires when it hits. */
  fallingStar(target: THREE.Vector3, onLand: () => void): void {
    const star = glowSprite('#fff6b0', 1.6, 1);
    const from = new THREE.Vector3(target.x + 6, 16, target.z - 6);
    let landed = false;
    this.add(star, 1.1, (k) => {
      const t = Math.min(1, k / 0.75);
      star.position.lerpVectors(from, target, t * t);
      if (t >= 1 && !landed) {
        landed = true;
        this.flash = 0.6;
        onLand();
      }
      (star.material as THREE.SpriteMaterial).opacity = t >= 1 ? Math.max(0, 1 - (k - 0.75) * 4) : 1;
    });
  }
}

/** A friendly cartoon moon face texture with craters. */
function moonCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(54, 50, 10, 64, 64, 60);
  grad.addColorStop(0, '#fffbe8');
  grad.addColorStop(1, '#e8e0c4');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(190,180,150,0.45)';
  for (const [x, y, r] of [[40, 44, 10], [82, 76, 13], [56, 90, 7], [90, 40, 6]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}
