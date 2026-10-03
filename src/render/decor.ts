import * as THREE from 'three';
import { addOutlines, glowSprite, toon } from './materials';

// Decorations, built from simple chunky shapes in the toy-box style (toon
// shading plus navy outlines). Each builder draws one catalog item around the
// origin, standing on y = 0. Glows tagged `night` brighten after dark.

type V3 = [number, number, number];

class Kit {
  readonly g = new THREE.Group();

  add(geo: THREE.BufferGeometry, color: string, p: V3, emissive?: string, rot?: V3, scale?: V3): THREE.Mesh {
    const m = new THREE.Mesh(geo, toon(color, emissive, emissive ? 0.9 : 1));
    m.position.set(...p);
    if (rot) m.rotation.set(...rot);
    if (scale) m.scale.set(...scale);
    m.castShadow = true;
    this.g.add(m);
    return m;
  }
  cyl(rt: number, rb: number, h: number, color: string, p: V3, emissive?: string, rot?: V3, seg = 8) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, p, emissive, rot);
  }
  box(w: number, h: number, d: number, color: string, p: V3, rot?: V3, emissive?: string) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, p, emissive, rot);
  }
  ball(r: number, color: string, p: V3, scale?: V3, emissive?: string) {
    return this.add(new THREE.SphereGeometry(r, 10, 7), color, p, emissive, undefined, scale);
  }
  cone(r: number, h: number, color: string, p: V3, rot?: V3, seg = 8, emissive?: string) {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, p, emissive, rot);
  }
  ico(r: number, color: string, p: V3, rot?: V3, scale?: V3, emissive?: string) {
    return this.add(new THREE.IcosahedronGeometry(r, 0), color, p, emissive, rot, scale);
  }
  torus(R: number, t: number, color: string, p: V3, rot?: V3, arc = Math.PI * 2, emissive?: string) {
    return this.add(new THREE.TorusGeometry(R, t, 6, 20, arc), color, p, emissive, rot);
  }
  glow(color: string, size: number, y: number, x = 0, z = 0) {
    const s = glowSprite(color, size, 0.8);
    s.position.set(x, y, z);
    s.userData.night = true;
    this.g.add(s);
  }

  // shared pieces
  flower(x: number, z: number, color: string, h = 0.3, size = 0.09) {
    this.cyl(0.015, 0.015, h, '#5e9a45', [x, h / 2, z], undefined, undefined, 4);
    this.ball(size, color, [x, h + size * 0.4, z]);
    this.ball(size * 0.45, '#ffe066', [x, h + size * 0.9, z]);
  }
  post(x: number, z: number, h: number, color = '#8a5a36', r = 0.05) {
    return this.cyl(r, r * 1.2, h, color, [x, h / 2, z], undefined, undefined, 6);
  }
  leafy(h: number, r: number, greens: string[], trunk = '#8a5a36', trunkR = 0.12) {
    this.cyl(trunkR * 0.8, trunkR, h, trunk, [0, h / 2, 0], undefined, undefined, 7);
    greens.forEach((c, i) => this.ico(r - i * r * 0.15, c, [Math.sin(i * 2.1) * r * 0.35, h + i * r * 0.5, Math.cos(i * 2.1) * r * 0.35], [i, i * 2, 0]));
  }
  flame(x: number, y: number, z: number, s = 1) {
    this.cone(0.07 * s, 0.2 * s, '#ff9a2a', [x, y, z], undefined, 6, '#ff6a00');
    this.cone(0.04 * s, 0.13 * s, '#ffe27a', [x, y + 0.01, z], undefined, 6, '#ffd21a');
  }
}

const B: Record<string, (k: Kit) => void> = {
  // ---------------------------------------------------------------- nature
  flowerbed(k) {
    k.cyl(0.75, 0.8, 0.12, '#7a5236', [0, 0.06, 0], undefined, undefined, 12);
    const colors = ['#ff8fb1', '#ffe066', '#b9a6ff', '#ffffff', '#ff9f68'];
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      const r = 0.15 + (i % 4) * 0.15;
      k.flower(Math.cos(a) * r, Math.sin(a) * r, colors[i % colors.length]);
    }
  },
  clover(k) {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.3;
      const r = 0.1 + (i % 3) * 0.17;
      for (let j = 0; j < 3; j++) k.ball(0.07, i === 4 && j === 0 ? '#9fe86a' : '#5fbf4a', [Math.cos(a) * r + Math.cos(j * 2.1) * 0.06, 0.08, Math.sin(a) * r + Math.sin(j * 2.1) * 0.06], [1, 0.35, 1]);
    }
    k.ball(0.05, '#ffffff', [0.12, 0.13, -0.1]);
  },
  flowerpots(k) {
    ([[-0.25, 0, '#ff8fb1'], [0.15, -0.15, '#ffe066'], [0.12, 0.25, '#b9a6ff']] as const).forEach(([x, z, c], i) => {
      k.cyl(0.13, 0.1, 0.22 + i * 0.03, '#d0703a', [x, 0.11, z]);
      k.flower(x, z, c, 0.4 + i * 0.05, 0.1);
    });
  },
  tulips(k) {
    k.box(1.2, 0.1, 0.35, '#7a5236', [0, 0.05, 0]);
    const cs = ['#ff4a6a', '#ffd21a', '#ff8fd0', '#ff7a2a', '#ffffff'];
    for (let i = 0; i < 5; i++) {
      const x = -0.48 + i * 0.24;
      k.cyl(0.015, 0.015, 0.35, '#5e9a45', [x, 0.25, 0], undefined, undefined, 4);
      k.cone(0.08, 0.16, cs[i], [x, 0.48, 0], [Math.PI, 0, 0], 6);
    }
  },
  fern(k) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      k.ball(0.28, i % 2 ? '#4fae3a' : '#6fcf4a', [Math.cos(a) * 0.18, 0.2, Math.sin(a) * 0.18], [0.35, 0.12, 1], ).rotation.set(0.6, -a, 0);
    }
  },
  nest(k) {
    // a stone pedestal with a straw nest on top, like the first ones on Kindred Grove
    k.cyl(0.45, 0.55, 0.35, '#b9b19a', [0, 0.17, 0]);
    k.torus(0.36, 0.13, '#a8783f', [0, 0.42, 0], [-Math.PI / 2, 0, 0]);
    k.cyl(0.3, 0.3, 0.05, '#e8c872', [0, 0.4, 0], undefined, undefined, 10);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.box(0.2, 0.03, 0.04, '#d8b060', [Math.cos(a) * 0.4, 0.5, Math.sin(a) * 0.4], [0, -a + 0.5, 0.3]);
    }
  },
  fruittree(k) {
    k.leafy(1.1, 0.55, ['#5fbf4a', '#4fae3a', '#6fd05a'], '#7a5236', 0.14);
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + 0.4;
      const berry = k.ball(0.11, '#6a5aff', [Math.cos(a) * 0.5, 1.2 + (i % 2) * 0.25, Math.sin(a) * 0.5], undefined, '#4a3ad0');
      berry.userData.berry = i;
      berry.visible = false;
    }
  },
  sunflowers(k) {
    ([[0, 0, 1.0], [0.25, 0.15, 0.8], [-0.22, 0.12, 0.7]] as const).forEach(([x, z, h]) => {
      k.cyl(0.025, 0.03, h, '#5e9a45', [x, h / 2, z], undefined, undefined, 5);
      k.ball(0.11, '#5e9a45', [x + 0.08, h * 0.5, z], [1, 0.3, 0.6]);
      k.cyl(0.2, 0.2, 0.04, '#ffd21a', [x, h, z + 0.02], undefined, [Math.PI / 2 - 0.2, 0, 0], 12);
      k.cyl(0.09, 0.09, 0.05, '#7a4a1a', [x, h, z + 0.04], undefined, [Math.PI / 2 - 0.2, 0, 0], 10);
    });
  },
  cattails(k) {
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      const h = 0.7 + (i % 3) * 0.15;
      k.cyl(0.015, 0.02, h, '#6f9a3a', [Math.cos(a) * 0.12, h / 2, Math.sin(a) * 0.12], undefined, [Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12], 4);
      k.cyl(0.04, 0.04, 0.18, '#7a4a2a', [Math.cos(a) * 0.12 * 1.6, h - 0.05, Math.sin(a) * 0.12 * 1.6], undefined, [Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12], 6);
    }
  },
  mushrooms(k) {
    ([[0, 0, 1, '#e2483e'], [0.22, 0.1, 0.7, '#ff9a5a'], [-0.18, 0.15, 0.6, '#e2483e'], [0.05, -0.22, 0.5, '#c98bd6']] as const).forEach(([x, z, s, c]) => {
      k.cyl(0.05 * s, 0.07 * s, 0.25 * s, '#fff3e2', [x, 0.12 * s, z]);
      k.add(new THREE.SphereGeometry(0.17 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), c, [x, 0.22 * s, z]);
      k.ball(0.03 * s, '#ffffff', [x + 0.06 * s, 0.33 * s, z + 0.05 * s]);
    });
  },
  mushroomRing(k) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = 0.7 + (i % 3) * 0.2;
      k.cyl(0.04 * s, 0.05 * s, 0.22 * s, '#fff3e2', [Math.cos(a) * 0.8, 0.11 * s, Math.sin(a) * 0.8]);
      k.add(new THREE.SphereGeometry(0.12 * s, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? '#e2483e' : '#c98bd6', [Math.cos(a) * 0.8, 0.2 * s, Math.sin(a) * 0.8], '#3a1f3a');
    }
    k.glow('#e7b6ff', 2.6, 0.3);
  },
  cactuspot(k) {
    k.cyl(0.2, 0.15, 0.25, '#d0703a', [0, 0.12, 0]);
    k.cyl(0.11, 0.12, 0.5, '#5fbf4a', [0, 0.45, 0], undefined, undefined, 8);
    k.ball(0.11, '#5fbf4a', [0, 0.7, 0]);
    k.cyl(0.05, 0.05, 0.2, '#5fbf4a', [0.15, 0.52, 0], undefined, [0, 0, -0.9]);
    k.ball(0.05, '#ff8fd0', [0, 0.82, 0]);
  },
  logpile(k) {
    for (let i = 0; i < 3; i++) k.cyl(0.12, 0.12, 0.8, '#9a5a32', [-0.13 + i * 0.13 * 2 - 0.13, 0.12, 0], undefined, [0, 0, Math.PI / 2]);
    for (let i = 0; i < 2; i++) k.cyl(0.12, 0.12, 0.8, '#8a4a2a', [-0.13 + i * 0.26, 0.33, 0], undefined, [0, 0, Math.PI / 2]);
    k.cyl(0.12, 0.12, 0.8, '#9a5a32', [0, 0.54, 0], undefined, [0, 0, Math.PI / 2]);
  },
  rosebush(k) {
    k.ico(0.4, '#3f9a35', [0, 0.35, 0], [0.2, 0.5, 0], [1, 0.85, 1]);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      k.ball(0.07, i % 2 ? '#ff4a6a' : '#ff8fb1', [Math.cos(a) * 0.32, 0.3 + (i % 3) * 0.12, Math.sin(a) * 0.32]);
    }
  },
  hedge(k) {
    k.box(1.6, 0.6, 0.45, '#4fae3a', [0, 0.3, 0]);
    k.box(1.6, 0.06, 0.47, '#6fcf4a', [0, 0.6, 0]);
  },
  berrybush(k) {
    k.ico(0.42, '#4fae3a', [0, 0.35, 0], [0.3, 0.2, 0], [1, 0.8, 1]);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.2;
      k.ball(0.06, '#4a5ac8', [Math.cos(a) * 0.35, 0.25 + (i % 3) * 0.15, Math.sin(a) * 0.35]);
    }
  },
  haybale(k) {
    k.cyl(0.4, 0.4, 0.7, '#e8c25a', [0, 0.4, 0], undefined, [0, 0, Math.PI / 2], 12);
    for (const x of [-0.18, 0.18]) k.torus(0.41, 0.025, '#b0742e', [x, 0.4, 0], [0, Math.PI / 2, 0]);
  },
  pine(k) {
    k.cyl(0.1, 0.14, 0.6, '#7a4a2a', [0, 0.3, 0]);
    for (let i = 0; i < 3; i++) k.cone(0.55 - i * 0.13, 0.7, i % 2 ? '#2f8a3a' : '#3a9a45', [0, 0.75 + i * 0.42, 0], undefined, 8);
  },
  topiary(k) {
    k.cyl(0.18, 0.15, 0.3, '#d0703a', [0, 0.15, 0]);
    k.cyl(0.04, 0.04, 0.5, '#7a4a2a', [0, 0.5, 0]);
    k.ball(0.35, '#4fae3a', [0, 0.9, 0]);
  },
  birch(k) {
    k.cyl(0.09, 0.12, 1.6, '#f4f0e8', [0, 0.8, 0]);
    for (let i = 0; i < 5; i++) k.box(0.1, 0.03, 0.03, '#2a2a2a', [0.05, 0.3 + i * 0.28, 0.09]);
    k.ico(0.5, '#9fd84a', [0, 1.8, 0]);
    k.ico(0.38, '#b8e86a', [0.2, 2.1, 0.1]);
  },
  bigshroom(k) {
    k.cyl(0.18, 0.25, 0.9, '#fff3e2', [0, 0.45, 0], undefined, undefined, 10);
    k.add(new THREE.SphereGeometry(0.7, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#e2483e', [0, 0.85, 0], undefined, undefined, [1, 0.7, 1]);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05;
      k.ball(0.08, '#ffffff', [Math.cos(a) * 0.45, 1.13, Math.sin(a) * 0.45], [1, 0.5, 1]);
    }
    k.ball(0.1, '#ffffff', [0, 1.33, 0], [1, 0.5, 1]);
  },
  bamboo(k) {
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      const h = 1.2 + (i % 3) * 0.35;
      const x = Math.cos(a) * 0.2;
      const z = Math.sin(a) * 0.2;
      k.cyl(0.05, 0.05, h, '#8fc85a', [x, h / 2, z], undefined, undefined, 6);
      for (let j = 1; j < 4; j++) k.cyl(0.058, 0.058, 0.03, '#6fa83a', [x, (h / 4) * j, z], undefined, undefined, 6);
      k.ball(0.15, '#5fbf4a', [x + 0.1, h, z], [1, 0.25, 0.5]);
    }
  },
  pumpkins(k) {
    ([[0, 0, 0.32], [0.45, 0.2, 0.22], [-0.4, 0.15, 0.25], [0.1, -0.4, 0.18]] as const).forEach(([x, z, r]) => {
      k.ball(r, '#ff8a2a', [x, r * 0.75, z], [1.15, 0.85, 1.15]);
      k.cyl(0.03, 0.04, 0.12, '#5e7a2a', [x, r * 1.5 + 0.03, z]);
    });
    k.torus(0.3, 0.02, '#5fbf4a', [0, 0.05, 0.3], [Math.PI / 2, 0, 0], Math.PI);
  },
  bonsai(k) {
    k.box(0.6, 0.15, 0.4, '#3a6ab0', [0, 0.08, 0]);
    k.cyl(0.05, 0.08, 0.35, '#7a4a2a', [0, 0.32, 0], undefined, [0, 0, 0.4]);
    k.cyl(0.04, 0.05, 0.3, '#7a4a2a', [-0.12, 0.55, 0], undefined, [0, 0, -0.9]);
    k.ball(0.18, '#3f9a35', [-0.25, 0.65, 0], [1.4, 0.55, 1]);
    k.ball(0.15, '#4fae3a', [0.12, 0.62, 0.05], [1.4, 0.55, 1]);
  },
  palmtree(k) {
    for (let i = 0; i < 6; i++) k.cyl(0.08, 0.1, 0.32, i % 2 ? '#b07a44' : '#9a6638', [i * 0.04, 0.16 + i * 0.3, 0]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.ball(0.35, i % 2 ? '#3fbf4a' : '#5fd45a', [0.24 + Math.cos(a) * 0.35, 1.85, Math.sin(a) * 0.35], [1.5, 0.12, 0.45]).rotation.set(0, -a, -0.35);
    }
    k.ball(0.08, '#7a5a2a', [0.3, 1.78, 0.1]);
    k.ball(0.08, '#7a5a2a', [0.18, 1.78, -0.08]);
  },
  topiarybun(k) {
    k.cyl(0.3, 0.25, 0.25, '#d0703a', [0, 0.12, 0]);
    k.ball(0.32, '#4fae3a', [0, 0.55, 0], [1, 0.9, 1.1]);
    k.ball(0.2, '#4fae3a', [0, 0.95, 0.12]);
    for (const s of [1, -1]) k.ball(0.07, '#4fae3a', [s * 0.08, 1.25, 0.1], [1, 3, 1]);
    k.ball(0.1, '#6fcf4a', [0, 0.5, -0.35]);
  },
  maple(k) {
    k.leafy(1.1, 0.6, ['#e8502a', '#ff8a2a', '#d0302a'], '#6a3a22', 0.13);
  },
  willow(k) {
    k.cyl(0.14, 0.22, 1.4, '#6a4a2a', [0, 0.7, 0]);
    k.ball(0.8, '#6fbf4a', [0, 1.6, 0], [1, 0.6, 1]);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      k.box(0.12, 0.9, 0.04, i % 2 ? '#5fae3a' : '#7fcf5a', [Math.cos(a) * 0.7, 1.05, Math.sin(a) * 0.7], [0, -a, 0]);
    }
  },
  // ---------------------------------------------------------------- stone
  steppingstones(k) {
    for (let i = 0; i < 4; i++) k.cyl(0.2, 0.22, 0.06, '#c9c2a8', [-0.6 + i * 0.4, 0.03, Math.sin(i * 1.6) * 0.2], undefined, undefined, 7);
  },
  boulder(k) {
    k.ico(0.55, '#9a948a', [0, 0.35, 0], [0.3, 0.4, 0.1], [1.1, 0.8, 1]);
    k.ball(0.3, '#6fae55', [0.1, 0.72, 0.05], [1.4, 0.35, 1.2]);
  },
  cairn(k) {
    ([[0.3, 0.12], [0.24, 0.32], [0.18, 0.49], [0.12, 0.62]] as const).forEach(([r, y], i) => k.ball(r, i % 2 ? '#a8a28b' : '#bdb6a0', [0, y, 0], [1, 0.55, 0.9]));
  },
  birdbath(k) {
    k.cyl(0.12, 0.2, 0.6, '#c9c2a8', [0, 0.3, 0]);
    k.cyl(0.38, 0.25, 0.12, '#d8d0b8', [0, 0.64, 0], undefined, undefined, 12);
    k.cyl(0.32, 0.32, 0.02, '#5fd0ff', [0, 0.71, 0], '#3ab0e8', undefined, 12);
  },
  stoneArch(k) {
    for (const s of [1, -1]) k.box(0.35, 1.6, 0.35, '#a8a28b', [0.7 * s, 0.8, 0]);
    k.box(1.9, 0.35, 0.4, '#b4ad95', [0, 1.7, 0]);
    k.ball(0.3, '#6fae55', [-0.5, 1.9, 0], [1.4, 0.5, 1]);
    k.ball(0.2, '#6fae55', [0.75, 1.0, 0.15], [1, 0.6, 1]);
  },
  standingstone(k) {
    k.box(0.45, 1.5, 0.3, '#8a8478', [0, 0.75, 0], [0, 0.2, 0.05]);
    k.ball(0.1, '#9fe8ff', [0, 1.0, 0.16], [1, 1, 0.3], '#5fd0ff');
    k.glow('#9fe8ff', 1.2, 1.0, 0, 0.2);
  },
  pillar(k) {
    k.box(0.7, 0.15, 0.7, '#e8e0cc', [0, 0.08, 0]);
    k.cyl(0.24, 0.26, 0.9, '#f4ecd8', [0, 0.6, 0], undefined, undefined, 10);
    k.cyl(0.24, 0.24, 0.3, '#f4ecd8', [0.45, 0.24, 0.2], undefined, [0, 0.5, Math.PI / 2], 10);
  },
  geode(k) {
    // a rock ring, cracked open, full of purple crystals
    k.torus(0.32, 0.17, '#8a7f86', [0, 0.45, 0], undefined, Math.PI * 2);
    k.cyl(0.33, 0.33, 0.08, '#5a4a6a', [0, 0.45, -0.05], undefined, [Math.PI / 2, 0, 0], 14);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.cone(0.06, 0.2, i % 2 ? '#c9a8ff' : '#b07aff', [Math.cos(a) * 0.17, 0.45 + Math.sin(a) * 0.17, 0.02], [0, 0, a - Math.PI / 2], 5, '#7a4ad8');
    }
    k.ico(0.08, '#e0d0ff', [0, 0.45, 0.04], undefined, undefined, '#9a6aff');
    k.glow('#c9a8ff', 1.4, 0.45);
  },
  well(k) {
    k.cyl(0.55, 0.55, 0.5, '#a8a28b', [0, 0.25, 0], undefined, undefined, 12);
    k.cyl(0.45, 0.45, 0.02, '#3a7ab0', [0, 0.48, 0], undefined, undefined, 12);
    for (const s of [1, -1]) k.post(s * 0.5, 0, 1.3);
    k.cone(0.75, 0.45, '#c8503a', [0, 1.45, 0], undefined, 4).rotation.y = Math.PI / 4;
    k.cyl(0.04, 0.04, 1.0, '#7a4a2a', [0, 1.05, 0], undefined, [0, 0, Math.PI / 2]);
    k.cyl(0.1, 0.08, 0.15, '#8a5a36', [0, 0.8, 0]);
  },
  fossil(k) {
    k.ico(0.5, '#c8b898', [0, 0.35, 0], [0.2, 0.3, 0], [1.2, 0.75, 0.6]);
    k.torus(0.18, 0.04, '#e8dcc0', [0, 0.4, 0.28], undefined, Math.PI * 1.6);
    k.torus(0.09, 0.03, '#e8dcc0', [0.03, 0.42, 0.29], undefined, Math.PI * 1.4);
  },
  statue(k) {
    k.box(0.6, 0.25, 0.6, '#a8a28b', [0, 0.12, 0]);
    k.ball(0.28, '#b8b2a0', [0, 0.45, 0], [1.1, 0.8, 1]);
    for (const s of [1, -1]) k.ball(0.1, '#b8b2a0', [s * 0.13, 0.68, 0.1]);
    for (const s of [1, -1]) k.ball(0.04, '#8a8478', [s * 0.13, 0.7, 0.18]);
  },
  obelisk(k) {
    k.box(0.5, 0.15, 0.5, '#d8c890', [0, 0.08, 0]);
    k.cyl(0.12, 0.2, 1.5, '#e8d8a8', [0, 0.9, 0], undefined, [0, Math.PI / 4, 0], 4);
    k.cone(0.12, 0.25, '#ffd21a', [0, 1.77, 0], [0, Math.PI / 4, 0], 4, '#e8a800');
  },
  fountain(k) {
    k.cyl(0.85, 0.9, 0.3, '#c9c2a8', [0, 0.15, 0], undefined, undefined, 14);
    k.cyl(0.75, 0.75, 0.02, '#5fd0ff', [0, 0.29, 0], '#3ab0e8', undefined, 14);
    k.cyl(0.1, 0.14, 0.7, '#d8d0b8', [0, 0.6, 0]);
    k.cyl(0.35, 0.2, 0.12, '#d8d0b8', [0, 0.95, 0], undefined, undefined, 12);
    k.ball(0.12, '#9fe8ff', [0, 1.1, 0], [1, 1.4, 1], '#5fd0ff');
  },
  // ---------------------------------------------------------------- lights
  lantern(k) {
    k.cyl(0.05, 0.07, 1.4, '#4a3a2a', [0, 0.7, 0], undefined, undefined, 6);
    k.box(0.4, 0.04, 0.04, '#4a3a2a', [0.15, 1.38, 0]);
    k.cyl(0.12, 0.14, 0.26, '#ffe9a8', [0.3, 1.2, 0], '#ffcf5a', undefined, 6);
    k.glow('#ffd27a', 2.4, 1.2, 0.3);
  },
  torch(k) {
    k.cyl(0.05, 0.06, 1.3, '#9a6638', [0, 0.65, 0], undefined, undefined, 6);
    k.cyl(0.1, 0.07, 0.2, '#c8945a', [0, 1.35, 0]);
    k.flame(0, 1.53, 0, 1.4);
    k.glow('#ffb04a', 2.2, 1.5);
  },
  candles(k) {
    ([[0, 0, 0.35], [0.15, 0.08, 0.25], [-0.12, 0.1, 0.2], [0.05, -0.15, 0.15]] as const).forEach(([x, z, h]) => {
      k.cyl(0.06, 0.06, h, '#fff4e0', [x, h / 2, z]);
      k.flame(x, h + 0.08, z, 0.6);
    });
    k.glow('#ffd27a', 1.6, 0.4);
  },
  glowjar(k) {
    k.cyl(0.16, 0.16, 0.36, '#cdeeff', [0, 0.18, 0], '#9fd8ff');
    k.cyl(0.17, 0.17, 0.06, '#b0742e', [0, 0.39, 0]);
    for (let i = 0; i < 4; i++) k.ball(0.03, '#fff27a', [Math.cos(i * 1.7) * 0.08, 0.1 + i * 0.06, Math.sin(i * 1.7) * 0.08], undefined, '#ffe14d');
    k.glow('#fff27a', 1.4, 0.2);
  },
  lamppost(k) {
    k.cyl(0.05, 0.08, 1.8, '#3a4a5a', [0, 0.9, 0], undefined, undefined, 6);
    k.cyl(0.14, 0.18, 0.08, '#3a4a5a', [0, 0.04, 0], undefined, undefined, 8);
    k.cyl(0.12, 0.16, 0.28, '#fff4c0', [0, 1.9, 0], '#ffd27a', undefined, 6);
    k.cone(0.2, 0.15, '#3a4a5a', [0, 2.11, 0], undefined, 6);
    k.glow('#ffd27a', 2.6, 1.9);
  },
  campfire(k) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.ico(0.1, '#9a948a', [Math.cos(a) * 0.4, 0.06, Math.sin(a) * 0.4]);
    }
    for (let i = 0; i < 3; i++) k.cyl(0.05, 0.05, 0.6, '#8a4a2a', [0, 0.1, 0], undefined, [0.35, (i * Math.PI) / 3, Math.PI / 2]);
    k.flame(0, 0.25, 0, 2.2);
    k.glow('#ff9a2a', 3, 0.4);
  },
  mushroomlamp(k) {
    k.cyl(0.06, 0.08, 0.7, '#fff3e2', [0, 0.35, 0]);
    k.add(new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#b07aff', [0, 0.68, 0], '#8a4ad8');
    k.glow('#c9a8ff', 2.2, 0.75);
  },
  stringlights(k) {
    for (const s of [1, -1]) k.post(s * 0.8, 0, 1.4);
    const cs = ['#ff7ab0', '#ffd21a', '#5fd0ff', '#9fe86a', '#ff9a5a'];
    for (let i = 0; i < 5; i++) {
      const x = -0.6 + i * 0.3;
      const y = 1.3 - Math.sin(((i + 1) / 6) * Math.PI) * 0.25;
      k.ball(0.08, cs[i], [x, y, 0], [1, 1.2, 1], cs[i]);
    }
    k.glow('#ffe0a0', 2.6, 1.15);
  },
  starlamp(k) {
    k.cyl(0.04, 0.06, 1.5, '#3a4a5a', [0, 0.75, 0], undefined, undefined, 6);
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 0.1 : 0.24;
      if (i) shape.lineTo(Math.cos(a) * r, -Math.sin(a) * r);
      else shape.moveTo(Math.cos(a) * r, -Math.sin(a) * r);
    }
    k.add(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }), '#ffe27a', [0, 1.7, -0.04], '#ffc21a');
    k.glow('#fff27a', 2.4, 1.7);
  },
  moonlamp(k) {
    k.cyl(0.04, 0.06, 1.5, '#3a4a5a', [0, 0.75, 0], undefined, undefined, 6);
    k.torus(0.2, 0.08, '#fff4c0', [0, 1.75, 0], [0, 0, 0.6], Math.PI * 1.2, '#ffe27a');
    k.glow('#e8ecff', 2.4, 1.75);
  },
  // ---------------------------------------------------------------- cozy
  signpost(k) {
    k.post(0, 0, 1.1);
    k.box(0.6, 0.18, 0.05, '#c8945a', [0.15, 0.95, 0], [0, 0, 0.05]);
    k.box(0.5, 0.16, 0.05, '#b8844a', [-0.1, 0.7, 0.02], [0, 0.6, -0.05]);
  },
  fence(k) {
    for (let i = 0; i < 5; i++) {
      k.box(0.12, 0.6, 0.05, '#ffffff', [-0.6 + i * 0.3, 0.3, 0]);
      k.cone(0.085, 0.12, '#ffffff', [-0.6 + i * 0.3, 0.66, 0], [0, Math.PI / 4, 0], 4);
    }
    for (const y of [0.18, 0.45]) k.box(1.4, 0.07, 0.04, '#f0ece4', [0, y, -0.04]);
  },
  bench(k) {
    k.box(1.2, 0.08, 0.38, '#c8945a', [0, 0.42, 0]);
    k.box(1.2, 0.3, 0.06, '#c8945a', [0, 0.65, -0.18], [-0.15, 0, 0]);
    for (const s of [1, -1]) k.box(0.08, 0.42, 0.36, '#4a3a2a', [s * 0.5, 0.21, 0]);
  },
  mailbox(k) {
    k.post(0, 0, 0.9);
    k.box(0.28, 0.24, 0.42, '#3a8ad8', [0, 0.95, 0]);
    k.cyl(0.14, 0.14, 0.42, '#3a8ad8', [0, 1.07, 0], undefined, [Math.PI / 2, 0, 0], 10);
    k.box(0.03, 0.18, 0.1, '#ff4a4a', [0.16, 1.1, 0.1]);
  },
  picnic(k) {
    k.box(1.3, 0.02, 1.0, '#ff6a6a', [0, 0.01, 0]);
    for (let i = 0; i < 4; i++) k.box(0.15, 0.025, 1.0, '#ffffff', [-0.45 + i * 0.3, 0.012, 0]);
    k.box(0.4, 0.25, 0.28, '#c8945a', [0.3, 0.14, -0.2]);
    k.torus(0.14, 0.02, '#8a5a36', [0.3, 0.3, -0.2], undefined, Math.PI);
    k.cyl(0.18, 0.16, 0.08, '#f4d48a', [-0.3, 0.06, 0.2], undefined, undefined, 12);
  },
  barrel(k) {
    ([[0, 0], [0.38, 0.15]] as const).forEach(([x, z]) => {
      k.cyl(0.2, 0.2, 0.5, '#a86a3a', [x, 0.25, z], undefined, undefined, 10);
      for (const y of [0.08, 0.42]) k.torus(0.205, 0.02, '#4a4a5a', [x, y, z], [Math.PI / 2, 0, 0]);
    });
  },
  birdhouse(k) {
    k.post(0, 0, 1.1);
    k.box(0.32, 0.32, 0.32, '#ffd27a', [0, 1.25, 0]);
    k.cone(0.3, 0.22, '#ff5a5a', [0, 1.52, 0], [0, Math.PI / 4, 0], 4);
    k.cyl(0.05, 0.05, 0.02, '#3a2a1a', [0, 1.27, 0.165], undefined, [Math.PI / 2, 0, 0]);
  },
  crates(k) {
    k.box(0.5, 0.45, 0.5, '#c8945a', [0, 0.23, 0]);
    k.box(0.4, 0.38, 0.4, '#b8844a', [0.05, 0.65, 0.02], [0, 0.4, 0]);
    k.box(0.45, 0.4, 0.45, '#d8a46a', [0.5, 0.2, -0.1], [0, -0.3, 0]);
  },
  table(k) {
    k.cyl(0.42, 0.42, 0.06, '#c8945a', [0, 0.55, 0], undefined, undefined, 12);
    k.cyl(0.05, 0.08, 0.55, '#8a5a36', [0, 0.27, 0]);
    for (const s of [1, -1]) k.cyl(0.16, 0.14, 0.3, '#ff9fcf', [s * 0.6, 0.15, 0], undefined, undefined, 10);
    k.ball(0.1, '#ffffff', [0, 0.65, 0], [1.2, 0.9, 1]);
    k.cyl(0.02, 0.02, 0.12, '#ffffff', [0.13, 0.66, 0], undefined, [0, 0, -0.9]);
  },
  parasol(k) {
    k.post(0, 0, 1.6, '#f4efe4', 0.03);
    k.cone(0.8, 0.35, '#ff7ab0', [0, 1.65, 0], undefined, 8);
    k.cone(0.55, 0.25, '#ffffff', [0, 1.71, 0], undefined, 8);
    k.cone(0.3, 0.15, '#ff7ab0', [0, 1.79, 0], undefined, 8);
    k.ball(0.05, '#ffd21a', [0, 1.88, 0]);
  },
  wheelbarrow(k) {
    k.box(0.7, 0.3, 0.5, '#3a8ad8', [0, 0.4, 0]);
    k.cyl(0.15, 0.15, 0.06, '#4a4a5a', [0.45, 0.15, 0], undefined, [Math.PI / 2, 0, 0], 10);
    for (const s of [1, -1]) k.cyl(0.025, 0.025, 0.5, '#8a5a36', [-0.5, 0.45, s * 0.2], undefined, [0, 0, Math.PI / 2 - 0.3]);
    for (let i = 0; i < 6; i++) k.ball(0.08, ['#ff8fb1', '#ffe066', '#b9a6ff'][i % 3], [-0.2 + (i % 3) * 0.2, 0.6, -0.12 + Math.floor(i / 3) * 0.24]);
  },
  rocker(k) {
    for (const s of [1, -1]) k.torus(0.5, 0.03, '#8a5a36', [0, 0.5, s * 0.22], [0, 0, Math.PI + 0.5], 1.2);
    k.box(0.5, 0.06, 0.48, '#c8945a', [0, 0.38, 0]);
    k.box(0.06, 0.6, 0.48, '#c8945a', [-0.25, 0.68, 0], [0, 0, 0.15]);
    k.box(0.3, 0.05, 0.42, '#ff9fcf', [0, 0.43, 0]);
  },
  swing(k) {
    for (const s of [1, -1]) {
      k.cyl(0.04, 0.05, 1.6, '#8a5a36', [s * 0.75, 0.75, 0.25], undefined, [-0.3, 0, 0]);
      k.cyl(0.04, 0.05, 1.6, '#8a5a36', [s * 0.75, 0.75, -0.25], undefined, [0.3, 0, 0]);
    }
    k.cyl(0.04, 0.04, 1.6, '#8a5a36', [0, 1.5, 0], undefined, [0, 0, Math.PI / 2]);
    for (const s of [1, -1]) k.cyl(0.01, 0.01, 1.0, '#f4efe4', [s * 0.2, 1.0, 0]);
    k.box(0.5, 0.05, 0.2, '#ff7ab0', [0, 0.5, 0]);
  },
  hammock(k) {
    for (const s of [1, -1]) k.post(s * 0.9, 0, 1.0);
    k.torus(0.85, 0.12, '#ffb04a', [0, 0.9, 0], [0, 0, Math.PI], Math.PI).scale.set(1, 0.45, 1.8);
  },
  tent(k) {
    k.cone(0.9, 1.2, '#3aa86a', [0, 0.6, 0], [0, Math.PI / 4, 0], 4);
    k.cone(0.35, 0.6, '#1a5a3a', [0, 0.3, 0.42], [0, Math.PI / 4, 0], 4).scale.set(1, 1, 0.3);
    k.post(0, 0, 1.4, '#8a5a36', 0.025);
    k.box(0.2, 0.12, 0.01, '#ffd21a', [0.1, 1.33, 0]);
  },
  flowercart(k) {
    k.box(1.0, 0.35, 0.6, '#c8945a', [0, 0.5, 0]);
    for (const s of [1, -1]) k.cyl(0.22, 0.22, 0.06, '#8a5a36', [0.3 * s, 0.22, 0.32], undefined, [Math.PI / 2, 0, 0], 12);
    k.cyl(0.025, 0.025, 0.6, '#8a5a36', [-0.75, 0.55, 0], undefined, [0, 0, Math.PI / 2 - 0.2]);
    const cs = ['#ff8fb1', '#ffe066', '#b9a6ff', '#ffffff', '#ff9f68', '#ff4a6a'];
    for (let i = 0; i < 12; i++) k.ball(0.09, cs[i % cs.length], [-0.4 + (i % 6) * 0.16, 0.75 + Math.floor(i / 6) * 0.08, -0.15 + Math.floor(i / 6) * 0.3]);
  },
  // ---------------------------------------------------------------- fun
  ball(k) {
    k.ball(0.25, '#ff5a5a', [0, 0.25, 0]);
    k.torus(0.251, 0.04, '#ffffff', [0, 0.25, 0], [Math.PI / 2, 0, 0]);
    k.torus(0.251, 0.04, '#ffd21a', [0, 0.25, 0]);
  },
  foodbowl(k) {
    k.cyl(0.28, 0.2, 0.15, '#3a8ad8', [0, 0.08, 0], undefined, undefined, 12);
    for (let i = 0; i < 6; i++) k.ball(0.06, '#c8803a', [Math.cos(i) * 0.12, 0.16, Math.sin(i) * 0.12]);
  },
  blocks(k) {
    const cs = ['#ff5a5a', '#ffd21a', '#3aa8ff', '#5fd03a', '#b07aff'];
    ([[0, 0, 0], [0.26, 0, 0.05], [0.12, 0.25, 0.02], [-0.3, 0, -0.15], [0.4, 0, -0.3]] as const).forEach(([x, y, z], i) => k.box(0.24, 0.24, 0.24, cs[i], [x, y + 0.12, z], [0, i * 0.4, 0]));
  },
  pinwheels(k) {
    ([[0, 0, '#ff5a5a'], [0.2, 0.12, '#3aa8ff'], [-0.18, 0.1, '#ffd21a']] as const).forEach(([x, z, c], i) => {
      const h = 0.8 - i * 0.12;
      k.post(x, z, h, '#f4efe4', 0.015);
      for (let j = 0; j < 4; j++) k.box(0.18, 0.08, 0.01, j % 2 ? c : '#ffffff', [x, h, z + 0.03], [0, 0, (j * Math.PI) / 2 + 0.4]).geometry.translate(0.09, 0, 0);
    });
  },
  petbed(k) {
    k.torus(0.4, 0.14, '#ff9fcf', [0, 0.14, 0], [Math.PI / 2, 0, 0]);
    k.cyl(0.4, 0.4, 0.08, '#ffe0ef', [0, 0.06, 0], undefined, undefined, 14);
    k.ball(0.1, '#ffffff', [0.1, 0.15, 0.05], [1.3, 0.6, 1]);
  },
  gnome(k) {
    k.ball(0.18, '#3a8ad8', [0, 0.2, 0], [1, 1.2, 1]);
    k.ball(0.13, '#ffd0a8', [0, 0.45, 0]);
    k.ball(0.11, '#ffffff', [0, 0.38, 0.07], [1.1, 1.2, 0.7]);
    k.cone(0.14, 0.35, '#e2483d', [0, 0.68, 0], [0.15, 0, 0], 8);
    k.ball(0.04, '#ff8a7a', [0, 0.45, 0.13]);
  },
  balloons(k) {
    k.ico(0.12, '#9a948a', [0, 0.08, 0]);
    ([[0, 1.5, 0, '#ff5a5a'], [0.25, 1.35, 0.1, '#ffd21a'], [-0.22, 1.4, -0.05, '#3aa8ff'], [0.05, 1.25, -0.25, '#b07aff']] as const).forEach(([x, y, z, c]) => {
      k.ball(0.18, c, [x, y, z], [1, 1.2, 1]);
      k.cyl(0.006, 0.006, y - 0.1, '#ffffff', [x / 2, y / 2, z / 2], undefined, [z, 0, -x]);
    });
  },
  bunting(k) {
    for (const s of [1, -1]) k.post(s * 0.85, 0, 1.3);
    const cs = ['#ff5a5a', '#ffd21a', '#3aa8ff', '#5fd03a', '#ff7ab0', '#b07aff'];
    for (let i = 0; i < 6; i++) {
      const x = -0.65 + i * 0.26;
      const y = 1.22 - Math.sin(((i + 0.5) / 6) * Math.PI) * 0.18;
      k.cone(0.09, 0.2, cs[i], [x, y - 0.08, 0], [Math.PI, 0, 0], 3).scale.set(1, 1, 0.2);
    }
  },
  scarecrow(k) {
    k.post(0, 0, 1.3);
    k.cyl(0.03, 0.03, 0.9, '#8a5a36', [0, 0.95, 0], undefined, [0, 0, Math.PI / 2]);
    k.box(0.4, 0.45, 0.2, '#3a8ad8', [0, 0.85, 0]);
    k.ball(0.17, '#f4d48a', [0, 1.3, 0]);
    k.cyl(0.28, 0.28, 0.03, '#c8945a', [0, 1.43, 0], undefined, undefined, 12);
    k.cyl(0.14, 0.17, 0.18, '#c8945a', [0, 1.52, 0]);
  },
  snowman(k) {
    k.ball(0.32, '#ffffff', [0, 0.3, 0]);
    k.ball(0.23, '#ffffff', [0, 0.75, 0]);
    k.ball(0.16, '#ffffff', [0, 1.08, 0]);
    k.cone(0.04, 0.16, '#ff8a2a', [0, 1.08, 0.2], [Math.PI / 2, 0, 0], 6);
    k.torus(0.17, 0.05, '#e2483d', [0, 0.95, 0], [Math.PI / 2, 0, 0]);
    k.cyl(0.13, 0.13, 0.16, '#2a2a3a', [0, 1.28, 0]);
  },
  sandbox(k) {
    for (const [w, d, x, z] of [[1.4, 0.1, 0, 0.65], [1.4, 0.1, 0, -0.65], [0.1, 1.3, 0.65, 0], [0.1, 1.3, -0.65, 0]] as const) k.box(w, 0.2, d, '#c8945a', [x, 0.1, z]);
    k.box(1.2, 0.12, 1.2, '#f4dca0', [0, 0.06, 0]);
    k.cyl(0.12, 0.09, 0.18, '#ff5a5a', [0.25, 0.2, 0.2]);
    k.ball(0.2, '#f4dca0', [-0.25, 0.12, -0.2], [1, 0.6, 1]);
  },
  seesaw(k) {
    k.cone(0.18, 0.35, '#3aa8ff', [0, 0.17, 0], undefined, 4);
    k.box(1.6, 0.06, 0.2, '#ffd21a', [0, 0.36, 0], [0, 0, 0.15]);
    for (const s of [1, -1]) k.cyl(0.02, 0.02, 0.2, '#ff5a5a', [s * 0.65, 0.45 + s * 0.1, 0], undefined, [Math.PI / 2, 0, 0]);
  },
  slide(k) {
    k.box(0.5, 0.06, 0.5, '#3aa8ff', [-0.45, 0.9, 0]);
    for (const [x, z] of [[-0.68, -0.22], [-0.68, 0.22], [-0.22, -0.22], [-0.22, 0.22]]) k.post(x, z, 0.9, '#ff5a5a', 0.03);
    k.box(1.2, 0.04, 0.4, '#ffd21a', [0.25, 0.48, 0], [0, 0, -0.65]);
    for (let i = 0; i < 4; i++) k.box(0.04, 0.03, 0.4, '#f4efe4', [-0.72, 0.2 + i * 0.2, 0]);
  },
  windmill(k) {
    k.cyl(0.35, 0.5, 1.8, '#f4ecd8', [0, 0.9, 0], undefined, undefined, 8);
    k.cone(0.5, 0.5, '#c8503a', [0, 2.05, 0], undefined, 8);
    k.box(0.2, 0.3, 0.02, '#8a5a36', [0, 0.18, 0.47]);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + 0.3;
      k.box(0.18, 0.8, 0.03, '#f4efe4', [Math.cos(a) * 0.42, 1.6 + Math.sin(a) * 0.42, 0.52], [0, 0, a - Math.PI / 2]);
    }
    k.ball(0.08, '#8a5a36', [0, 1.6, 0.52]);
  },
  airballoon(k) {
    k.box(0.4, 0.3, 0.4, '#c8945a', [0, 0.15, 0]);
    for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) k.cyl(0.01, 0.01, 0.6, '#8a5a36', [x * 1.4, 0.6, z * 1.4], undefined, [z, 0, -x]);
    k.ball(0.7, '#ff5a5a', [0, 1.55, 0], [1, 1.15, 1]);
    for (let i = 0; i < 4; i++) k.ball(0.705, '#ffd21a', [0, 1.55, 0], [0.2, 1.16, 1.01]).rotation.y = (i * Math.PI) / 4;
  },
  // ---------------------------------------------------------------- magic (Starshards)
  windchime(k) {
    k.cyl(0.04, 0.05, 1.8, '#4a3a2a', [0, 0.9, 0], undefined, undefined, 6);
    k.torus(0.25, 0.03, '#d6c8ff', [0, 1.75, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      k.cyl(0.025, 0.025, 0.4 + i * 0.05, '#e8e4ff', [Math.cos(a) * 0.22, 1.45, Math.sin(a) * 0.22], '#9f8fff', undefined, 5);
    }
    k.glow('#c9b6ff', 1.8, 1.4);
  },
  crystal(k) {
    for (const [x, z, h, r] of [[0, 0, 1.2, 0.0], [0.25, 0.1, 0.8, 0.3], [-0.22, 0.12, 0.7, -0.3], [0.05, -0.25, 0.6, 0.2]] as const) {
      const c = k.add(new THREE.OctahedronGeometry(0.22, 0), '#9fe8ff', [x, h * 0.45, z], '#5fd0ff');
      c.scale.set(0.7, h * 2.2, 0.7);
      c.rotation.z = r;
    }
    k.glow('#8fe8ff', 3, 0.6);
  },
  sakura(k) {
    k.cyl(0.12, 0.2, 1.6, '#6b4636', [0, 0.8, 0]);
    const pinks = ['#ffc4dc', '#ffb0cf', '#ffd8e8'];
    for (let i = 0; i < 4; i++) k.ico(0.7 - i * 0.08, pinks[i % 3], [Math.sin(i * 2) * 0.4, 1.8 + i * 0.25, Math.cos(i * 2) * 0.4], [i, i * 2, 0]);
  },
  fairydoor(k) {
    k.ball(0.45, '#5fbf4a', [0, 0.05, 0], [1, 0.8, 1]);
    k.cyl(0.16, 0.16, 0.05, '#c8503a', [0, 0.2, 0.4], undefined, [Math.PI / 2 - 0.3, 0, 0], 12);
    k.ball(0.025, '#ffd21a', [0.08, 0.2, 0.44]);
    k.glow('#fff3b0', 1.2, 0.25, 0, 0.4);
  },
  orbs(k) {
    ([[0, 0.8, 0, '#9fe8ff'], [0.25, 0.6, 0.1, '#ff9fcf'], [-0.2, 0.55, -0.1, '#fff27a']] as const).forEach(([x, y, z, c]) => {
      k.ball(0.12, c, [x, y, z], undefined, c);
      k.glow(c, 1, y, x, z);
    });
    k.cyl(0.25, 0.3, 0.08, '#a8a28b', [0, 0.04, 0], undefined, undefined, 10);
  },
  starshrine(k) {
    k.box(0.7, 0.2, 0.5, '#c9c2a8', [0, 0.1, 0]);
    for (const s of [1, -1]) k.box(0.1, 0.8, 0.1, '#c8503a', [s * 0.28, 0.6, 0]);
    k.box(0.85, 0.1, 0.18, '#c8503a', [0, 1.02, 0]);
    k.ico(0.15, '#ffe27a', [0, 0.55, 0], undefined, undefined, '#ffc21a');
    k.glow('#fff27a', 1.8, 0.55);
  },
  cloudcushion(k) {
    ([[0, 0.3, 0, 0.4], [0.35, 0.25, 0.1, 0.3], [-0.32, 0.25, -0.05, 0.32], [0.05, 0.45, 0.05, 0.3]] as const).forEach(([x, y, z, r]) => k.ball(r, '#ffffff', [x, y, z], [1, 0.75, 1]));
  },
  rainbowarch(k) {
    const cs = ['#ff4a4a', '#ffb02a', '#ffe23a', '#5ad64a', '#3aa8ff', '#9a5aff'];
    cs.forEach((c, i) => k.torus(0.95 - i * 0.1, 0.05, c, [0, 0.05, 0], undefined, Math.PI));
    for (const s of [1, -1]) k.ball(0.22, '#ffffff', [s * 0.75, 0.12, 0], [1.3, 0.7, 1]);
  },
  floatrock(k) {
    k.ico(0.35, '#9a948a', [0, 1.0, 0], [0.4, 0.3, 0], [1.2, 0.7, 1]);
    k.ball(0.28, '#6fae55', [0, 1.22, 0], [1.3, 0.3, 1.1]);
    k.cone(0.2, 0.35, '#8a8478', [0, 0.7, 0], [Math.PI, 0, 0], 6);
    k.glow('#c9e8ff', 1.6, 0.4);
  },
  auroralamp(k) {
    k.cyl(0.18, 0.22, 0.12, '#3a4a5a', [0, 0.06, 0]);
    k.cyl(0.14, 0.14, 0.7, '#5affc0', [0, 0.47, 0], '#3ad8a0', undefined, 8);
    k.cyl(0.145, 0.145, 0.25, '#b07aff', [0, 0.65, 0], '#8a4ad8', undefined, 8);
    k.glow('#5affc0', 2.2, 0.5);
  },
  moongate(k) {
    k.torus(0.8, 0.12, '#c9c2a8', [0, 0.85, 0]);
    k.box(1.0, 0.12, 0.3, '#a8a28b', [0, 0.06, 0]);
    k.torus(0.66, 0.03, '#e8ecff', [0, 0.85, 0], undefined, Math.PI * 2, '#b9c6ff');
    k.glow('#d4dcff', 2.4, 0.85);
  },
  glowtree(k) {
    k.cyl(0.1, 0.16, 1.3, '#3a3a5a', [0, 0.65, 0]);
    ['#5fd0ff', '#3ab0e8', '#9fe8ff'].forEach((c, i) => k.ico(0.6 - i * 0.12, c, [Math.sin(i * 2) * 0.3, 1.45 + i * 0.3, Math.cos(i * 2) * 0.3], [i, i, 0], undefined, c));
    k.glow('#5fd0ff', 3, 1.6);
  },
  shroomhouse(k) {
    k.cyl(0.42, 0.5, 0.8, '#fff3e2', [0, 0.4, 0], undefined, undefined, 12);
    k.add(new THREE.SphereGeometry(0.85, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#e2483e', [0, 0.75, 0], undefined, undefined, [1, 0.75, 1]);
    for (let i = 0; i < 6; i++) k.ball(0.09, '#ffffff', [Math.cos(i) * 0.55, 1.15, Math.sin(i) * 0.55], [1, 0.5, 1]);
    k.box(0.22, 0.36, 0.04, '#8a5a36', [0, 0.18, 0.47]);
    k.cyl(0.08, 0.08, 0.03, '#fff27a', [0.22, 0.5, 0.44], '#ffd21a', [Math.PI / 2, 0, 0], 8);
    k.glow('#fff27a', 1.4, 0.5, 0.22, 0.48);
  },
  dragonstatue(k) {
    k.box(0.8, 0.2, 0.6, '#a8a28b', [0, 0.1, 0]);
    k.torus(0.3, 0.12, '#3aa86a', [0, 0.45, 0], [Math.PI / 2, 0, 0], Math.PI * 1.6);
    k.ball(0.17, '#3aa86a', [0.28, 0.7, 0.05], [1.2, 1, 1]);
    for (const s of [1, -1]) k.cone(0.04, 0.18, '#ffd21a', [0.24, 0.88, s * 0.07], [0, 0, -0.4], 5);
    k.ball(0.03, '#ffd21a', [0.42, 0.74, 0.1], undefined, '#ffc21a');
  },
  portal(k) {
    k.torus(0.75, 0.14, '#7a5ad8', [0, 0.9, 0]);
    k.add(new THREE.CircleGeometry(0.62, 24), '#c9a8ff', [0, 0.9, 0], '#9a6aff');
    for (const s of [1, -1]) k.box(0.3, 0.3, 0.3, '#5a4a7a', [s * 0.6, 0.15, 0]);
    k.glow('#c9a8ff', 3, 0.9);
  },
  goldaxolotl(k) {
    k.box(0.6, 0.25, 0.6, '#c9c2a8', [0, 0.12, 0]);
    k.ball(0.25, '#ffd21a', [0, 0.45, 0], [1.3, 0.8, 1], '#e8a800');
    k.ball(0.18, '#ffd21a', [0.3, 0.55, 0], undefined, '#e8a800');
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) k.cone(0.03, 0.15, '#ffe27a', [0.3, 0.58 + i * 0.05, s * (0.16 + i * 0.02)], [s * 1.2, 0, 0], 5, '#e8a800');
    k.glow('#ffe27a', 1.8, 0.5);
  },
};

export function buildDecor(id: string): THREE.Group {
  const k = new Kit();
  (B[id] ?? ((kk: Kit) => kk.box(0.5, 0.5, 0.5, '#ff00ff', [0, 0.25, 0])))(k);
  addOutlines(k.g, 2.6);
  return k.g;
}

/** Every decoration with a model (for tests). */
export const DECOR_MODELS = Object.keys(B);
