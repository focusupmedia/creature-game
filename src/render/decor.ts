import * as THREE from 'three';
import { addOutlines, glowSprite, toon } from './materials';

// Cosmetic decorations. Each returns a group; glows register as night lights.

export function buildDecor(id: string): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, color: string, p: [number, number, number], emissive?: string) => {
    const m = new THREE.Mesh(geo, toon(color, emissive, emissive ? 0.9 : 1));
    m.position.set(...p);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const nightGlow = (color: string, size: number, y: number) => {
    const s = glowSprite(color, size, 0.8);
    s.position.y = y;
    s.userData.night = true;
    g.add(s);
  };
  switch (id) {
    case 'lantern':
      add(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 6), '#4a3a2a', [0, 0.7, 0]);
      add(new THREE.BoxGeometry(0.4, 0.04, 0.04), '#4a3a2a', [0.15, 1.38, 0]);
      add(new THREE.CylinderGeometry(0.12, 0.14, 0.26, 6), '#ffe9a8', [0.3, 1.2, 0], '#ffcf5a');
      nightGlow('#ffd27a', 2.4, 1.2);
      break;
    case 'flowerbed': {
      add(new THREE.CylinderGeometry(0.75, 0.8, 0.12, 12), '#7a5236', [0, 0.06, 0]);
      const colors = ['#ff8fb1', '#ffe066', '#b9a6ff', '#ffffff', '#ff9f68'];
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4;
        const r = 0.15 + (i % 4) * 0.15;
        add(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 3), '#5e9a45', [Math.cos(a) * r, 0.25, Math.sin(a) * r]);
        add(new THREE.SphereGeometry(0.09, 6, 4), colors[i % colors.length], [Math.cos(a) * r, 0.42, Math.sin(a) * r]);
      }
      break;
    }
    case 'stoneArch':
      for (const s of [1, -1]) add(new THREE.BoxGeometry(0.35, 1.6, 0.35), '#a8a28b', [0.7 * s, 0.8, 0]);
      add(new THREE.BoxGeometry(1.9, 0.35, 0.4), '#b4ad95', [0, 1.7, 0]);
      add(new THREE.SphereGeometry(0.3, 6, 4), '#6fae55', [-0.5, 1.9, 0]).scale.set(1.4, 0.5, 1);
      add(new THREE.SphereGeometry(0.2, 6, 4), '#6fae55', [0.75, 1.0, 0.15]).scale.set(1, 0.6, 1);
      break;
    case 'mushroomRing':
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const s = 0.7 + (i % 3) * 0.2;
        add(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.22 * s, 6), '#fff3e2', [Math.cos(a) * 0.8, 0.11 * s, Math.sin(a) * 0.8]);
        add(new THREE.SphereGeometry(0.12 * s, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? '#e2483e' : '#c98bd6',
          [Math.cos(a) * 0.8, 0.2 * s, Math.sin(a) * 0.8], '#3a1f3a');
      }
      nightGlow('#e7b6ff', 2.6, 0.3);
      break;
    case 'crystal':
      for (const [x, z, h, r] of [[0, 0, 1.2, 0.0], [0.25, 0.1, 0.8, 0.3], [-0.22, 0.12, 0.7, -0.3], [0.05, -0.25, 0.6, 0.2]] as const) {
        const c = add(new THREE.OctahedronGeometry(0.22, 0), '#9fe8ff', [x, h * 0.45, z], '#5fd0ff');
        c.scale.set(0.7, h * 2.2, 0.7);
        c.rotation.z = r;
      }
      nightGlow('#8fe8ff', 3, 0.6);
      break;
    case 'windchime':
      add(new THREE.CylinderGeometry(0.04, 0.05, 1.8, 6), '#4a3a2a', [0, 0.9, 0]);
      add(new THREE.TorusGeometry(0.25, 0.03, 4, 12), '#d6c8ff', [0, 1.75, 0]).rotation.x = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(new THREE.CylinderGeometry(0.025, 0.025, 0.4 + i * 0.05, 5), '#e8e4ff', [Math.cos(a) * 0.22, 1.45, Math.sin(a) * 0.22], '#9f8fff');
      }
      nightGlow('#c9b6ff', 1.8, 1.4);
      break;
    case 'sakura': {
      add(new THREE.CylinderGeometry(0.12, 0.2, 1.6, 6), '#6b4636', [0, 0.8, 0]);
      const pinks = ['#ffc4dc', '#ffb0cf', '#ffd8e8'];
      for (let i = 0; i < 4; i++) {
        const b = add(new THREE.IcosahedronGeometry(0.7 - i * 0.08, 0), pinks[i % 3], [Math.sin(i * 2) * 0.4, 1.8 + i * 0.25, Math.cos(i * 2) * 0.4]);
        b.rotation.set(i, i * 2, 0);
      }
      break;
    }
    case 'fruittree': {
      add(new THREE.CylinderGeometry(0.1, 0.16, 1.1, 6), '#7a5236', [0, 0.55, 0]);
      const greens = ['#5fbf4a', '#4fae3a', '#6fd05a'];
      for (let i = 0; i < 3; i++) {
        const b = add(new THREE.IcosahedronGeometry(0.55 - i * 0.08, 0), greens[i], [Math.sin(i * 2.1) * 0.25, 1.25 + i * 0.22, Math.cos(i * 2.1) * 0.25]);
        b.rotation.set(i, i * 2, 0);
      }
      // berries show as they ripen (World turns them on)
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + 0.4;
        const berry = add(new THREE.SphereGeometry(0.11, 8, 6), '#6a5aff', [Math.cos(a) * 0.5, 1.2 + (i % 2) * 0.25, Math.sin(a) * 0.5], '#4a3ad0');
        berry.userData.berry = i;
        berry.visible = false;
      }
      break;
    }
    default:
      add(new THREE.BoxGeometry(0.5, 0.5, 0.5), '#ff00ff', [0, 0.25, 0]);
  }
  addOutlines(g, 2.6);
  return g;
}
