import * as THREE from 'three';

// Diorama camera: drag to spin the island (and tilt), two fingers to pan,
// pinch / wheel to zoom and twist to rotate, tap to select. On a mouse, right-
// or middle-drag (or shift-drag) pans. Spin and pan have inertia; pan is
// clamped to the island so the player can never lose the sanctuary.

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly focus = new THREE.Vector3(0, 0, 0);
  distance = 27;
  yaw = 0;
  pitch = 0.95; // radians above horizon
  minDist = 7;
  maxDist = 30;
  bound = 8;
  /** Centre of the island the camera is exploring; panning is clamped around it. */
  readonly center = new THREE.Vector3();
  /** How hard the player has been pushing past the island edge (for island hopping). */
  readonly overflow = new THREE.Vector2();
  onTap: (x: number, y: number) => void = () => {};
  /** Ground height under the focus point, so the camera rides over the dome. */
  ground: (x: number, z: number) => number = () => 0;
  private focusY = 0;
  private spin = 0;
  private panMode = false;
  /** Press and hold (without moving) to pick something up; return true to start carrying it. */
  onHold: (x: number, y: number) => boolean = () => false;
  onCarry: (x: number, y: number) => void = () => {};
  onCarryEnd: (x: number, y: number) => void = () => {};
  private carrying = false;
  private holdTried = true;
  private lastPos = { x: 0, y: 0 };

  private pointers = new Map<number, { x: number; y: number }>();
  private vel = new THREE.Vector2();
  private downAt = 0;
  private downPos = { x: 0, y: 0 };
  private moved = 0;
  private pinchStart = 0;
  private distStart = 0;
  private angleStart = 0;
  private yawStart = 0;
  private fly: { from: THREE.Vector3; to: THREE.Vector3; d0: number; d1: number; t: number } | null = null;

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

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    // Portrait phones see far less width: widen the lens and allow pulling back
    // far enough to take in the whole sanctuary.
    const portrait = w < h;
    this.camera.fov = portrait ? 52 : 38;
    this.maxDist = portrait ? 36 : 30;
    this.distance = Math.min(this.distance, this.maxDist);
    this.camera.updateProjectionMatrix();
  }

  /** Smoothly frame a point (used for reveals, arrivals, tutorials). */
  flyTo(p: { x: number; z: number }, distance = this.distance): void {
    this.fly = { from: this.focus.clone(), to: new THREE.Vector3(p.x, 0, p.z), d0: this.distance, d1: distance, t: 0 };
  }

  private down = (e: PointerEvent) => {
    if (this.carrying) return;
    this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.vel.set(0, 0);
    this.spin = 0;
    this.fly = null;
    if (this.pointers.size === 1) {
      this.downAt = performance.now();
      this.downPos = { x: e.clientX, y: e.clientY };
      this.moved = 0;
      this.panMode = e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || e.shiftKey);
      this.holdTried = this.panMode;
      this.lastPos = { x: e.clientX, y: e.clientY };
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
    if (this.pointers.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      this.moved += Math.abs(dx) + Math.abs(dy);
      if (this.moved > 8) this.holdTried = true;
      if (this.panMode) {
        this.panPixels(dx, dy);
        this.vel.set(dx, dy);
      } else {
        // spin the island around the point you're looking at, and tilt
        this.spin = -dx * this.spinRate;
        this.yaw += this.spin;
        this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, 0.55, 1.3);
      }
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      // two-finger drag pans by the movement of the midpoint
      const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const mdx = (cur.x - prev.x) / 2;
        const mdy = (cur.y - prev.y) / 2;
        this.panPixels(mdx, mdy);
        this.vel.set(mdx, mdy);
      }
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.distance = THREE.MathUtils.clamp(this.distStart * (this.pinchStart / Math.max(1, d)), this.minDist, this.maxDist);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      this.yaw = this.yawStart - (ang - this.angleStart);
    }
  };

  private get spinRate(): number {
    return 2.4 / Math.max(320, this.el.clientWidth);
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
    this.holdTried = true;
    if (this.pointers.size > 0) this.spin = 0;
    if (this.pointers.size === 0 && this.moved < 10 && performance.now() - this.downAt < 450) {
      this.vel.set(0, 0);
      this.onTap(this.downPos.x, this.downPos.y);
    }
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.distance = THREE.MathUtils.clamp(this.distance * (1 + Math.sign(e.deltaY) * 0.1), this.minDist, this.maxDist);
  };

  private panPixels(dx: number, dy: number): void {
    const scale = this.distance / Math.max(400, this.el.clientHeight) * 1.6;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.focus.addScaledVector(right, -dx * scale);
    this.focus.addScaledVector(fwd, -dy * scale);
    const ox = this.focus.x - this.center.x;
    const oz = this.focus.z - this.center.z;
    const len = Math.hypot(ox, oz);
    if (len > this.bound) {
      const k = this.bound / len;
      this.overflow.x += ox - ox * k;
      this.overflow.y += oz - oz * k;
      this.focus.x = this.center.x + ox * k;
      this.focus.z = this.center.z + oz * k;
    }
  }

  update(dt: number): void {
    if (this.pointers.size === 1 && !this.holdTried && performance.now() - this.downAt > 280) {
      this.holdTried = true;
      if (this.onHold(this.lastPos.x, this.lastPos.y)) {
        this.carrying = true;
        this.spin = 0;
        this.vel.set(0, 0);
      }
    }
    this.overflow.multiplyScalar(Math.pow(0.15, dt));
    if (this.pointers.size === 0 && this.vel.lengthSq() > 0.01) {
      this.panPixels(this.vel.x, this.vel.y);
      this.vel.multiplyScalar(Math.pow(0.02, dt));
    }
    if (this.pointers.size === 0 && Math.abs(this.spin) > 0.0002) {
      this.yaw += this.spin;
      this.spin *= Math.pow(0.04, dt);
    }
    if (this.fly) {
      this.fly.t = Math.min(1, this.fly.t + dt * 1.2);
      const k = 1 - Math.pow(1 - this.fly.t, 3);
      this.focus.lerpVectors(this.fly.from, this.fly.to, k);
      this.distance = this.fly.d0 + (this.fly.d1 - this.fly.d0) * k;
      if (this.fly.t >= 1) this.fly = null;
    }
    this.apply();
  }

  private apply(): void {
    // Closer zoom tilts the view lower, like leaning in over a diorama.
    const t = (this.distance - this.minDist) / (this.maxDist - this.minDist);
    const pitch = this.pitch * (0.7 + 0.3 * t) + 0.12;
    const c = this.camera;
    this.focusY += (this.ground(this.focus.x, this.focus.z) - this.focusY) * 0.12;
    c.position.set(
      this.focus.x + Math.sin(this.yaw) * Math.cos(pitch) * this.distance,
      this.focusY + Math.sin(pitch) * this.distance,
      this.focus.z + Math.cos(this.yaw) * Math.cos(pitch) * this.distance,
    );
    c.lookAt(this.focus.x, this.focusY + 0.5, this.focus.z);
  }
}
