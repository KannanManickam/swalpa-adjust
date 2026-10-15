// Procedural canvas textures (no image assets needed).
import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

function canvasTex(
  key: string,
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
  opts: { repeat?: boolean; srgb?: boolean } = {},
): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  if (opts.repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Soft radial glow, white — tint with material/instance colour. */
export function glowTexture(): THREE.Texture {
  return canvasTex('glow', 128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    r.addColorStop(0.45, 'rgba(255,255,255,0.22)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  });
}

/** Headlight beam: bright at the near end (left), fading forward. */
export function beamTexture(): THREE.Texture {
  return canvasTex('beam', 256, 128, (g) => {
    const lin = g.createLinearGradient(0, 0, 256, 0);
    lin.addColorStop(0, 'rgba(255,255,255,0.9)');
    lin.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    lin.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lin;
    g.beginPath();
    g.moveTo(0, 50);
    g.lineTo(256, 4);
    g.lineTo(256, 124);
    g.lineTo(0, 78);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'destination-in';
    const v = g.createLinearGradient(0, 0, 0, 128);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.5, 'rgba(0,0,0,1)');
    v.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = v;
    g.fillRect(0, 0, 256, 128);
  });
}

/** Plain white (for strokes and solid shapes). */
export function solidTexture(): THREE.Texture {
  return canvasTex('solid', 4, 4, (g) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 4, 4);
  });
}

/** Crisp ring outline for highlighting a vehicle. */
export function haloTexture(): THREE.Texture {
  return canvasTex('halo', 128, 128, (g) => {
    g.strokeStyle = '#fff';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(64, 64, 54, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.arc(64, 64, 50, 0, Math.PI * 2);
    g.fill();
  });
}

/** Expanding ring for honks / alerts. */
export function ringTexture(): THREE.Texture {
  return canvasTex('ring', 128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 40, 64, 64, 62);
    r.addColorStop(0, 'rgba(255,255,255,0)');
    r.addColorStop(0.6, 'rgba(255,255,255,0.9)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  });
}

/** Black and yellow painted kerb stripes (Bengaluru style). */
export function kerbTexture(): THREE.Texture {
  return canvasTex(
    'kerb',
    64,
    8,
    (g) => {
      g.fillStyle = '#e8b923';
      g.fillRect(0, 0, 32, 8);
      g.fillStyle = '#151515';
      g.fillRect(32, 0, 32, 8);
    },
    { repeat: true },
  );
}

export function barricadeTexture(): THREE.Texture {
  return canvasTex(
    'barricade',
    128,
    32,
    (g) => {
      g.fillStyle = '#f2f2f2';
      g.fillRect(0, 0, 128, 32);
      g.fillStyle = '#e4572e';
      for (let x = -32; x < 160; x += 32) {
        g.beginPath();
        g.moveTo(x, 32);
        g.lineTo(x + 16, 0);
        g.lineTo(x + 32, 0);
        g.lineTo(x + 16, 32);
        g.closePath();
        g.fill();
      }
      g.fillStyle = '#6d28d9';
      g.fillRect(0, 26, 128, 6);
    },
    { repeat: true },
  );
}

/** Subtle asphalt grain. */
export function asphaltTexture(): THREE.Texture {
  return canvasTex(
    'asphalt',
    256,
    256,
    (g) => {
      g.fillStyle = '#7d7d7d';
      g.fillRect(0, 0, 256, 256);
      const img = g.getImageData(0, 0, 256, 256);
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < img.data.length; i += 4) {
        const n = 110 + rnd() * 40 + (rnd() < 0.02 ? 40 : 0);
        img.data[i] = n;
        img.data[i + 1] = n;
        img.data[i + 2] = n + 3;
      }
      g.putImageData(img, 0, 0);
    },
    { repeat: true },
  );
}

export function pavingTexture(): THREE.Texture {
  return canvasTex(
    'paving',
    128,
    128,
    (g) => {
      g.fillStyle = '#8a8a8a';
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = 'rgba(40,40,40,0.55)';
      g.lineWidth = 2;
      for (let i = 0; i <= 128; i += 32) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, 128);
        g.stroke();
        g.beginPath();
        g.moveTo(0, i);
        g.lineTo(128, i);
        g.stroke();
      }
    },
    { repeat: true },
  );
}

/** Painted road text or arrow on a transparent quad. */
export function paintTexture(kind: string, color: string): THREE.Texture {
  return canvasTex(`paint:${kind}:${color}`, 256, 128, (g) => {
    g.fillStyle = color;
    g.strokeStyle = color;
    g.translate(128, 64);
    if (kind === 'S' || kind === 'L' || kind === 'R' || kind === 'SL') {
      // arrows drawn pointing +x (direction of travel)
      g.lineWidth = 12;
      g.lineCap = 'round';
      const head = (x: number, y: number, ang: number) => {
        g.save();
        g.translate(x, y);
        g.rotate(ang);
        g.beginPath();
        g.moveTo(22, 0);
        g.lineTo(-8, -18);
        g.lineTo(-8, 18);
        g.closePath();
        g.fill();
        g.restore();
      };
      if (kind === 'S' || kind === 'SL') {
        g.beginPath();
        g.moveTo(-100, 0);
        g.lineTo(70, 0);
        g.stroke();
        head(78, 0, 0);
      }
      if (kind === 'L' || kind === 'SL') {
        // left in y-down screen space = towards -y
        g.beginPath();
        g.moveTo(-100, kind === 'SL' ? 0 : 10);
        g.lineTo(-10, kind === 'SL' ? 0 : 10);
        g.quadraticCurveTo(25, kind === 'SL' ? 0 : 10, 25, -30);
        g.stroke();
        head(25, -40, -Math.PI / 2);
      }
      if (kind === 'R') {
        g.beginPath();
        g.moveTo(-100, -10);
        g.lineTo(-10, -10);
        g.quadraticCurveTo(25, -10, 25, 30);
        g.stroke();
        head(25, 40, Math.PI / 2);
      }
    } else {
      // painted words run along the lane (direction of travel = +x), tall and narrow like real road paint
      g.font = '800 64px "Geist Variable", system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const wTxt = g.measureText(kind).width;
      g.scale(Math.min(1, 236 / wTxt), 1.35);
      g.fillText(kind, 0, 2);
    }
  });
}

/** Warm street-light pools baked into one additive overlay for the whole diorama. */
export function lightPoolTexture(
  key: string,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  lamps: { x: number; y: number }[],
  extra: { x: number; y: number; r: number; a: number; c: string }[] = [],
): THREE.Texture {
  const W = bounds.maxX - bounds.minX;
  const H = bounds.maxY - bounds.minY;
  const scale = Math.min(4, 2048 / Math.max(W, H));
  const cw = Math.ceil(W * scale);
  const ch = Math.ceil(H * scale);
  return canvasTex(`pool:${key}`, cw, ch, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = 'lighter';
    const blob = (x: number, y: number, r: number, color: string, a: number) => {
      const px = (x - bounds.minX) * scale;
      const py = (y - bounds.minY) * scale;
      const rad = g.createRadialGradient(px, py, 0, px, py, r * scale);
      rad.addColorStop(0, color.replace('A', String(a)));
      rad.addColorStop(0.5, color.replace('A', String(a * 0.35)));
      rad.addColorStop(1, color.replace('A', '0'));
      g.fillStyle = rad;
      g.fillRect(px - r * scale, py - r * scale, r * 2 * scale, r * 2 * scale);
    };
    for (const l of lamps) blob(l.x, l.y, 15, 'rgba(255,196,128,A)', 0.5);
    for (const e of extra) blob(e.x, e.y, e.r, e.c, e.a);
  });
}
