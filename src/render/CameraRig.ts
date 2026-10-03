import * as THREE from 'three';

// Globe camera: the current island is a little planet and the camera orbits
// it. One finger (or the mouse) rolls the globe in any direction so you can
// look anywhere, two fingers pinch to zoom and twist to spin, the wheel zooms,
// a tap selects, and press-and-hold picks a creature up. Rolling has inertia.

const UP_LIMIT = 1.4;
const DOWN_LIMIT = -1.35;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  /** Centre of the globe being viewed. */
  readonly center = new THREE.Vector3();
  radius = 4.75;
  /** Distance from the globe centre. */
  distance = 18;
  yaw = 0;
  pitch = 0.85;
  onTap: (x: number, y: number) => void = () => {};
  /** Press and hold (without moving) to pick something up; return true to start carrying it. */
  onHold: (x: number, y: number) => boolean = () => false;
  onCarry: (x: number, y: number) => void = () => {};
  onCarryEnd: (x: number, y: number) => void = () => {};
  /** Press on something draggable (a decoration being placed); return true to drag it instead of rolling. */
  onDragStart: (x: number, y: number) => boolean = () => false;
  onDrag: (x: number, y: number) => void = () => {};
  onDragEnd: () => void = () => {};
  /** Called once the first time the player rolls the globe themselves. */
  onFirstRoll: () => void = () => {};

  private pointers = new Map<number, { x: number; y: number }>();
  private vel = new THREE.Vector2();
  private downAt = 0;
  private downPos = { x: 0, y: 0 };
  private lastPos = { x: 0, y: 0 };
  private moved = 0;
  private pinchStart = 0;
  private distStart = 0;
  private angleStart = 0;
  private yawStart = 0;
  private carrying = false;
  private dragging = false;
  private holdTried = true;
  private rolled = false;
  private portrait = true;
  private fly: { c0: THREE.Vector3; c1: THREE.Vector3; y0: number; y1: number; p0: number; p1: number; d0: number; d1: number; t: number } | null = null;

  constructor(private el: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
    el.addEventListener('wheel', this.wheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Taps open UI over the canvas; stop the browser's synthetic "ghost" click
    // from landing on that new UI (e.g. a sheet's backdrop) and closing it.
    el.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
    this.apply();
  }

  get minDist(): number {
    return this.radius + 2.4;
  }

  get maxDist(): number {
    return this.radius * 4.6 + (this.portrait ? 12 : 8);
  }

  /** A comfortable overview of the whole globe. */
  get overview(): number {
    return this.radius * 3.1 + (this.portrait ? 10 : 6);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.portrait = w < h;
    this.camera.fov = this.portrait ? 52 : 38;
    this.distance = THREE.MathUtils.clamp(this.distance, this.minDist, this.maxDist);
    this.camera.updateProjectionMatrix();
  }

  /** Switch to another globe (instantly, or with a smooth flight). */
  setGlobe(center: THREE.Vector3Like, radius: number, instant: boolean): void {
    this.radius = radius;
    if (instant) {
      this.fly = null;
      this.center.set(center.x, center.y, center.z);
      this.yaw = 0;
      this.pitch = 0.7;
      this.distance = this.overview;
    } else {
      this.startFly(new THREE.Vector3(center.x, center.y, center.z), 0, 0.7, this.overview);
    }
  }

  /** Smoothly turn the globe so a surface direction faces the camera. */
  lookAtDir(n: THREE.Vector3Like, distance = this.distance): void {
    const yaw = Math.atan2(n.x, n.z);
    // view from a little above the point so the horizon shows
    const pitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)) * 0.8 + 0.3, DOWN_LIMIT, UP_LIMIT);
    this.startFly(this.center.clone(), Math.abs(n.x) + Math.abs(n.z) < 0.05 ? this.yaw : yaw, pitch, THREE.MathUtils.clamp(distance, this.minDist, this.maxDist));
  }

  /** Touching the screen mid-flight takes over the view, but always lands on the target globe. */
  private stopFly(): void {
    if (this.fly) this.center.copy(this.fly.c1);
    this.fly = null;
  }

  private startFly(c1: THREE.Vector3, yaw: number, pitch: number, distance: number): void {
    let y1 = yaw;
    while (y1 - this.yaw > Math.PI) y1 -= Math.PI * 2;
    while (y1 - this.yaw < -Math.PI) y1 += Math.PI * 2;
    this.vel.set(0, 0);
    this.fly = { c0: this.center.clone(), c1, y0: this.yaw, y1, p0: this.pitch, p1: pitch, d0: this.distance, d1: distance, t: 0 };
  }

  private down = (e: PointerEvent) => {
    if (this.carrying || this.dragging) return;
    this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.vel.set(0, 0);
    this.stopFly();
    if (this.pointers.size === 1) {
      this.downAt = performance.now();
      this.downPos = { x: e.clientX, y: e.clientY };
      this.lastPos = { x: e.clientX, y: e.clientY };
      this.moved = 0;
      this.holdTried = e.pointerType === 'mouse' && e.button !== 0;
      if (this.onDragStart(e.clientX, e.clientY)) {
        this.dragging = true;
        this.holdTried = true;
      }
    } else if (this.pointers.size === 2) {
      this.holdTried = true;
      const [a, b] = [...this.pointers.values()];
      this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      this.distStart = this.distance;
      this.angleStart = Math.atan2(b.y - a.y, b.x - a.x);
      this.yawStart = this.yaw;
      this.moved = 999;
    }
  };

  /** Radians per pixel: gentler when zoomed in close. */
  private get rollRate(): number {
    const zoom = THREE.MathUtils.clamp((this.distance - this.minDist) / (this.overview - this.minDist), 0.3, 1.2);
    return (3.2 / Math.max(320, this.el.clientWidth)) * zoom;
  }

  private move = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    this.pointers.set(e.pointerId, cur);
    this.lastPos = cur;
    if (this.carrying) {
      this.onCarry(cur.x, cur.y);
      return;
    }
    if (this.dragging) {
      this.onDrag(cur.x, cur.y);
      return;
    }
    if (this.pointers.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      this.moved += Math.abs(dx) + Math.abs(dy);
      if (this.moved > 8) this.holdTried = true;
      if (this.moved > 12 && !this.rolled) {
        this.rolled = true;
        this.onFirstRoll();
      }
      this.roll(dx, dy);
      this.vel.set(dx, dy);
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.distance = THREE.MathUtils.clamp(this.distStart * (this.pinchStart / Math.max(1, d)), this.minDist, this.maxDist);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      this.yaw = this.yawStart - (ang - this.angleStart);
    }
  };

  private roll(dx: number, dy: number): void {
    const r = this.rollRate;
    this.yaw -= dx * r;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * r, DOWN_LIMIT, UP_LIMIT);
  }

  private up = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.carrying) {
      if (this.pointers.size === 0) {
        this.carrying = false;
        this.holdTried = true;
        this.onCarryEnd(e.clientX, e.clientY);
      }
      return;
    }
    if (this.dragging) {
      if (this.pointers.size === 0) {
        this.dragging = false;
        this.holdTried = true;
        this.onDragEnd();
      }
      return;
    }
    this.holdTried = true;
    if (this.pointers.size > 0) this.vel.set(0, 0);
    if (this.pointers.size === 0 && this.moved < 10 && performance.now() - this.downAt < 450) {
      this.vel.set(0, 0);
      this.onTap(this.downPos.x, this.downPos.y);
    }
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.stopFly();
    this.distance = THREE.MathUtils.clamp(this.distance * (1 + Math.sign(e.deltaY) * 0.1), this.minDist, this.maxDist);
  };

  update(dt: number): void {
    if (this.pointers.size === 1 && !this.holdTried && performance.now() - this.downAt > 280) {
      this.holdTried = true;
      if (this.onHold(this.lastPos.x, this.lastPos.y)) {
        this.carrying = true;
        this.vel.set(0, 0);
      }
    }
    if (this.pointers.size === 0 && this.vel.lengthSq() > 0.01) {
      this.roll(this.vel.x, this.vel.y);
      this.vel.multiplyScalar(Math.pow(0.03, dt));
    }
    if (this.fly) {
      const f = this.fly;
      f.t = Math.min(1, f.t + dt * 1.1);
      const k = 1 - Math.pow(1 - f.t, 3);
      this.center.lerpVectors(f.c0, f.c1, k);
      this.yaw = f.y0 + (f.y1 - f.y0) * k;
      this.pitch = f.p0 + (f.p1 - f.p0) * k;
      this.distance = f.d0 + (f.d1 - f.d0) * k;
      if (f.t >= 1) this.fly = null;
    }
    this.apply();
  }

  private apply(): void {
    const c = this.camera;
    const cp = Math.cos(this.pitch);
    c.position.set(
      this.center.x + Math.sin(this.yaw) * cp * this.distance,
      this.center.y + Math.sin(this.pitch) * this.distance,
      this.center.z + Math.cos(this.yaw) * cp * this.distance,
    );
    c.lookAt(this.center);
  }
}
