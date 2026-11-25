/* 使用 Three.js 传统脚本版本，双击 index.html 即可运行，无需本地服务器 */
const THREE = window.THREE;
const OrbitControls = THREE.OrbitControls;

/* ---------- helpers ---------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (v, step = 0.1) => (step >= 1 ? String(Math.round(v)) : step >= 0.1 ? v.toFixed(1) : v.toFixed(2));
const P = (label, min, max, step, value) => ({ label, min, max, step, value, type: 'range' });
const PC = (label, value) => ({ label, type: 'color', value });
const PB = (label, value = false) => ({ label, type: 'bool', value: !!value });

/* ---------- materials & primitives ---------- */
const C = {
  floor: new THREE.MeshStandardMaterial({ color: 0xd8d8d4, roughness: 0.96 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf0efeb, roughness: 0.85 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xb99b75, roughness: 0.82 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2c2c2a, roughness: 0.72 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x909390, metalness: 0.35, roughness: 0.45 }),
  accent: new THREE.MeshStandardMaterial({ color: 0xb45b3a, roughness: 0.72 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xf2e6d8, roughness: 0.85 })
};
const SHARED = new Set(Object.values(C));
const dynMat = (hex, roughness = 0.75) => new THREE.MeshStandardMaterial({ color: hex, roughness });
// 桌子默认白台面，可在属性面板单独换色
const TABLE_WHITE = '#ffffff';
// 舞台默认蓝（婚礼模板显式保留红色）
const STAGE_BLUE = '#2f4f7a';
// 台面/踏步使用同色系的浅色调，换色时整体一起变化
const tintMat = (hex, mix = 0.28) => new THREE.MeshStandardMaterial({
  color: new THREE.Color(hex).lerp(new THREE.Color(0xffffff), mix), roughness: 0.82
});

function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function ball(r, m, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}
// 统一椅子造型：勾选「无靠背」后只保留座面与椅腿
function addChair(g, x, z, ry = 0, backless = false) {
  const chair = new THREE.Group();
  chair.position.set(x, 0, z);
  chair.rotation.y = ry;
  chair.add(box(0.42, 0.06, 0.42, C.white, 0, 0.44, 0));
  if (!backless) chair.add(box(0.42, 0.44, 0.06, C.white, 0, 0.68, 0.18));
  for (const cx of [-0.18, 0.18]) for (const cz of [-0.18, 0.18])
    chair.add(box(0.04, 0.42, 0.04, C.dark, cx, 0.21, cz));
  g.add(chair);
}
// 灯具仅呈现实体造型，不做自发光与光束：效果图按白天场景处理
const lensMat = hex => dynMat(hex, 0.45);

// 两点之间的圆管，用于桁架弦杆与斜撑
const Y_AXIS = new THREE.Vector3(0, 1, 0);
function tube(a, b, radius, mat, seg = 8) {
  const start = new THREE.Vector3(a[0], a[1], a[2]);
  const end = new THREE.Vector3(b[0], b[1], b[2]);
  const dir = end.clone().sub(start);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, seg), mat);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 方形截面桁架梁：四根弦杆 + 四个面的三角斜撑（搭背景板的常规桁架）
function addTrussBeam(g, axis, from, to, cross, side, r) {
  const h = side / 2;
  const len = to - from;
  const n = clamp(Math.round(len / 0.65), 2, 40);
  if (axis === 'x') {
    const y = cross[0], z = cross[1];
    for (const dy of [-h, h]) for (const dz of [-h, h])
      g.add(tube([from, y + dy, z + dz], [to, y + dy, z + dz], r, C.metal, 6));
    for (let i = 0; i < n; i++) {
      const x0 = from + i * len / n;
      const x1 = from + (i + 1) * len / n;
      const flip = i % 2 === 0;
      for (const dz of [-h, h])
        g.add(tube([x0, y + (flip ? -h : h), z + dz], [x1, y + (flip ? h : -h), z + dz], r * 0.65, C.metal, 6));
      for (const dy of [-h, h])
        g.add(tube([x0, y + dy, z + (flip ? -h : h)], [x1, y + dy, z + (flip ? h : -h)], r * 0.65, C.metal, 6));
    }
  } else {
    const x = cross[0], z = cross[1];
    for (const dx of [-h, h]) for (const dz of [-h, h])
      g.add(tube([x + dx, from, z + dz], [x + dx, to, z + dz], r, C.metal, 6));
    for (let i = 0; i < n; i++) {
      const y0 = from + i * len / n;
      const y1 = from + (i + 1) * len / n;
      const flip = i % 2 === 0;
      for (const dz of [-h, h])
        g.add(tube([x + (flip ? -h : h), y0, z + dz], [x + (flip ? h : -h), y1, z + dz], r * 0.65, C.metal, 6));
      for (const dx of [-h, h])
        g.add(tube([x + dx, y0, z + (flip ? -h : h)], [x + dx, y1, z + (flip ? h : -h)], r * 0.65, C.metal, 6));
    }
  }
}

// 常规背景板桁架：横、纵都是完整桁架梁，斜撑在每段梁内部；宽/高增加时增加桁架格而不是几根钢
function buildTrussFrame(p) {
  const g = new THREE.Group();
  const W = p.width;
  const H = p.height;
  const side = clamp(p.depth, 0.18, 1.2);
  const r = 0.03;
  const h = side / 2;
  const low = 0.12 + h;
  const topY = H - h;

  // 约 3.5m 一榀、3m 一层：宽/高增加时横向和纵向都增加闭合桁架格，共用梁柱
  const cols = clamp(Math.round(W / 3.5), 1, 20);
  const rows = clamp(Math.round(H / 3), 1, 12);
  const innerW = Math.max(0.2, W - side);
  const xStep = innerW / cols;
  const xs = [];
  for (let i = 0; i <= cols; i++) xs.push(-innerW / 2 + i * xStep);
  const ys = [];
  for (let j = 0; j <= rows; j++) ys.push(low + j * (topY - low) / rows);

  // 竖向桁架柱：每一列贯通，底座与框同厚、不向前突出
  xs.forEach(x => {
    addTrussBeam(g, 'y', low, topY, [x, 0], side, r);
    g.add(box(Math.min(0.34, xStep * 0.45), 0.05, side, C.dark, x, 0.025, 0));
  });
  // 横向桁架梁：上下边梁 + 中间各层都是完整桁架，不是几根钢
  ys.forEach(y => addTrussBeam(g, 'x', xs[0], xs[cols], [y, 0], side, r));
  // 斜撑只在每段桁架内部（见 addTrussBeam 的四面三角撑），网格里不再额外加斜梁
  return g;
}

// 带灯桁架：射灯与泡灯沿横梁一盏一盏交替间隔分布（不发光、不投光束）
// size 只缩放灯具本体，排列间距保持不变
function addTrussLights(g, p, size = 1) {
  const zf = clamp(p.depth, 0.18, 1.2) / 2 + 0.16;
  const n = clamp(Math.round(p.count), 0, 40);
  const s = clamp(size, 0.2, 2);
  if (!n) return g;
  const armMat = lensMat(p.armColor);
  const bulbMat = lensMat(p.bulbColor);
  for (let i = 0; i < n; i++) {
    const x = -p.width / 2 + (i + 0.5) * p.width / n;
    if (i % 2 === 0) {
      g.add(box(0.16 * s, 0.16 * s, 0.16 * s, C.dark, x, p.height - 0.32 * s, zf));
      g.add(box(0.05 * s, 0.05 * s, 0.52 * s, C.metal, x, p.height - 0.32 * s, zf + 0.26 * s));
      const head = new THREE.Group();
      head.position.set(x, p.height - 0.48 * s, zf + 0.52 * s);
      head.rotation.x = 0.45;
      const barrel = cyl(0.14 * s, 0.17 * s, 0.54 * s, C.dark, 0, 0, 0, 16);
      barrel.rotation.x = Math.PI / 2;
      head.add(barrel);
      const lens = cyl(0.115 * s, 0.115 * s, 0.02 * s, armMat, 0, 0, 0.28 * s, 16);
      lens.rotation.x = Math.PI / 2;
      head.add(lens);
      head.add(box(0.05 * s, 0.36 * s, 0.05 * s, C.dark, -0.17 * s, 0.14 * s, 0));
      head.add(box(0.05 * s, 0.36 * s, 0.05 * s, C.dark, 0.17 * s, 0.14 * s, 0));
      g.add(head);
    } else {
      const y = p.height - 0.62 * s;
      g.add(tube([x, p.height - 0.3 * s, zf - 0.04 * s], [x, y, zf + 0.06 * s], 0.025 * s, C.metal, 6));
      const cup = cyl(0.12 * s, 0.09 * s, 0.09 * s, C.metal, x, y, zf + 0.12 * s, 12);
      cup.rotation.x = Math.PI / 2 + 0.35;
      g.add(cup);
      g.add(ball(0.085 * s, bulbMat, x, y - 0.03 * s, zf + 0.2 * s));
    }
  }
  return g;
}

/* ---------- module library ---------- */
const MODULES = {
  stage: {
    name: '舞台', cat: '舞台', icon: '台',
    params: { width: P('宽度', 2, 60, 0.5, 8), depth: P('进深', 1.5, 30, 0.5, 3), height: P('高度', 0.2, 5, 0.1, 0.6), color: PC('主体色', STAGE_BLUE) },
    build(p) {
      const g = new THREE.Group();
      g.add(box(p.width, p.height, p.depth, dynMat(p.color), 0, p.height / 2, 0));
      g.add(box(p.width + 0.12, 0.08, p.depth + 0.12, tintMat(p.color), 0, p.height + 0.04, 0));
      g.add(box(p.width, p.height * 0.86, 0.05, C.dark, 0, p.height * 0.43, p.depth / 2 + 0.03));
      return g;
    }
  },
  tstage: {
    name: 'T 型舞台', cat: '舞台', icon: 'T',
    params: {
      width: P('主台宽', 6, 60, 0.5, 12), depth: P('主台深', 2, 20, 0.5, 3.5),
      runway: P('T台长', 4, 60, 0.5, 10), runwayWidth: P('T台宽', 1.5, 20, 0.5, 3.2),
      height: P('高度', 0.2, 5, 0.1, 0.5), color: PC('主体色', STAGE_BLUE)
    },
    build(p) {
      const g = new THREE.Group();
      const zm = -p.depth / 2;
      const bodyMat = dynMat(p.color);
      g.add(box(p.width, p.height, p.depth, bodyMat, 0, p.height / 2, zm));
      g.add(box(p.width + 0.12, 0.08, p.depth + 0.12, tintMat(p.color), 0, p.height + 0.04, zm));
      g.add(box(p.runwayWidth, p.height, p.runway, bodyMat, 0, p.height / 2, p.runway / 2));
      g.add(box(p.runwayWidth + 0.1, 0.08, p.runway, tintMat(p.color), 0, p.height + 0.04, p.runway / 2));
      return g;
    }
  },
  stairs: {
    name: '台阶', cat: '舞台', icon: '阶',
    params: {
      width: P('宽度', 1, 40, 0.5, 3), height: P('高度', 0.2, 5, 0.1, 0.5),
      steps: P('级数', 2, 20, 1, 3), color: PC('踏步色', STAGE_BLUE)
    },
    build(p) {
      const g = new THREE.Group();
      const n = Math.round(p.steps);
      const h = p.height / n;
      const d = 0.42;
      const stepMat = dynMat(p.color);
      for (let i = 0; i < n; i++) {
        const stepH = h * (i + 1);
        const z = (n - i - 0.5) * d;
        g.add(box(p.width, stepH, d, stepMat, 0, stepH / 2, z));
        g.add(box(p.width + 0.06, 0.05, d, tintMat(p.color, 0.18), 0, stepH + 0.025, z));
      }
      return g;
    }
  },
  screen: {
    name: 'LED 屏', cat: '舞台', icon: '屏',
    params: { width: P('宽度', 2, 60, 0.5, 8), height: P('高度', 1.5, 30, 0.5, 3), base: P('离地', 0, 10, 0.1, 0.6), color: PC('画面', '#1d2b3a') },
    build(p) {
      const g = new THREE.Group();
      const y = p.base + p.height / 2;
      g.add(box(p.width + 0.12, p.height + 0.12, 0.1, C.dark, 0, y, 0));
      const panelMat = new THREE.MeshStandardMaterial({
        color: p.color, emissive: new THREE.Color(p.color).multiplyScalar(0.28), roughness: 0.4
      });
      g.add(box(p.width, p.height, 0.12, panelMat, 0, y, 0.07));
      for (const x of [-p.width * 0.32, p.width * 0.32]) {
        g.add(box(0.09, p.base, 0.09, C.metal, x, p.base / 2, 0));
        g.add(box(0.5, 0.05, 0.16, C.metal, x, 0.025, 0));
      }
      return g;
    }
  },
  backdrop: {
    name: '喷绘背景', cat: '舞台', icon: '喷',
    params: { width: P('宽度', 2, 60, 0.5, 8), height: P('高度', 1.5, 30, 0.5, 3), base: P('离地', 0, 10, 0.1, 0), color: PC('画面', '#f2ede4') },
    build(p) {
      const g = new THREE.Group();
      const y = p.base + p.height / 2;
      g.add(box(p.width, p.height, 0.06, dynMat(p.color), 0, y, 0));
      // 上下挂杆，便于和桁架搭配
      g.add(tube([-p.width / 2 - 0.1, y + p.height / 2 + 0.06, 0], [p.width / 2 + 0.1, y + p.height / 2 + 0.06, 0], 0.05, C.metal, 8));
      g.add(tube([-p.width / 2 - 0.1, y - p.height / 2 - 0.02, 0], [p.width / 2 + 0.1, y - p.height / 2 - 0.02, 0], 0.035, C.metal, 8));
      return g;
    }
  },
  truss: {
    name: '桁架', cat: '舞台', icon: '架',
    params: { width: P('跨度', 2, 80, 0.5, 8), height: P('高度', 2, 30, 0.5, 4.5), depth: P('框厚', 0.18, 1.2, 0.02, 0.3) },
    build(p) {
      return buildTrussFrame(p);
    }
  },
  trusslights: {
    name: '桁架（带灯）', cat: '舞台', icon: '灯',
    params: {
      width: P('跨度', 2, 80, 0.5, 8), height: P('高度', 2, 30, 0.5, 4.5), depth: P('框厚', 0.18, 1.2, 0.02, 0.3),
      count: P('灯具数', 0, 40, 1, 12),
      armColor: PC('射灯色', '#e8f0ff'), bulbColor: PC('泡灯色', '#ffe2b8')
    },
    build(p) {
      return addTrussLights(buildTrussFrame(p), p);
    }
  },
  // 屏幕/喷绘与桁架成套：桁架在画面后方，整体作为一个模组移动与编辑
  screenTruss: {
    name: 'LED屏（含桁架）', cat: '舞台', icon: '屏',
    params: {
      width: P('宽度', 2, 60, 0.5, 8), height: P('高度', 1.5, 30, 0.5, 3),
      base: P('离地', 0, 10, 0.1, 0.6), color: PC('画面', '#1d2b3a'),
      depth: P('桁架框厚', 0.18, 1.2, 0.02, 0.3)
    },
    build(p) {
      const g = new THREE.Group();
      // 桁架略窄于屏幕并退到后方，正面只看到干净的大屏
      const frame = buildTrussFrame({
        width: Math.max(0.5, p.width - 0.4),
        height: p.base + p.height,
        depth: p.depth
      });
      frame.position.z = -(clamp(p.depth, 0.18, 1.2) / 2 + 0.12);
      g.add(frame, MODULES.screen.build(p));
      return g;
    }
  },
  backdropTruss: {
    name: '喷绘背景（含桁架）', cat: '舞台', icon: '喷',
    params: {
      width: P('宽度', 2, 60, 0.5, 8), height: P('高度', 1.5, 30, 0.5, 3),
      base: P('离地', 0, 10, 0.1, 0), color: PC('画面', '#f2ede4'),
      depth: P('桁架框厚', 0.18, 1.2, 0.02, 0.3)
    },
    build(p) {
      const g = new THREE.Group();
      const side = clamp(p.depth, 0.18, 1.2);
      // 喷绘从正面完全包住桁架：桁架缩在画面范围内并退到后方
      const frame = buildTrussFrame({
        width: Math.max(0.5, p.width - 0.2),
        height: p.height - 0.04 + side,
        depth: p.depth
      });
      frame.position.set(0, p.base - 0.04 - side / 2, -(side / 2 + 0.12));
      g.add(frame, MODULES.backdrop.build(p));
      return g;
    }
  },
  backdropTrussLights: {
    name: '喷绘背景（带灯桁架）', cat: '舞台', icon: '灯',
    params: {
      width: P('宽度', 2, 60, 0.5, 8), height: P('高度', 1.5, 30, 0.5, 3),
      base: P('离地', 0, 10, 0.1, 0), color: PC('画面', '#f2ede4'),
      depth: P('桁架框厚', 0.18, 1.2, 0.02, 0.3),
      count: P('灯具数', 0, 40, 1, 12),
      armColor: PC('射灯色', '#e8f0ff'), bulbColor: PC('泡灯色', '#ffe2b8')
    },
    build(p) {
      const g = new THREE.Group();
      const side = clamp(p.depth, 0.18, 1.2);
      // 桁架藏在喷绘后，灯具前伸到喷绘前方；正面只看到喷绘和灯
      const tp = {
        width: Math.max(0.5, p.width - 0.2),
        height: p.height - 0.04 + side,
        depth: p.depth,
        count: p.count,
        armColor: p.armColor,
        bulbColor: p.bulbColor
      };
      // 喷绘上的灯具用较小尺寸，避免看起来过大
      const frame = addTrussLights(buildTrussFrame(tp), tp, 0.62);
      frame.position.set(0, p.base - 0.04 - side / 2, -(side / 2 + 0.12));
      g.add(frame, MODULES.backdrop.build(p));
      return g;
    }
  },
  podium: {
    name: '演讲台', cat: '舞台', icon: '讲',
    params: { width: P('宽度', 0.6, 8, 0.1, 1), height: P('高度', 0.9, 5, 0.1, 1.1) },
    build(p) {
      const g = new THREE.Group();
      g.add(box(p.width, p.height * 0.9, 0.5, C.dark, 0, p.height * 0.45, 0));
      const top = box(p.width + 0.1, 0.06, 0.56, C.white, 0, p.height * 0.9 + 0.03, -0.02);
      top.rotation.x = -0.12;
      g.add(top);
      g.add(box(0.16, 0.03, 0.1, C.accent, 0, p.height * 0.7, -0.27));
      return g;
    }
  },
  chairs: {
    name: '座椅阵列', cat: '单桌单椅', icon: '椅', hidden: true,
    params: { rows: P('排数', 1, 40, 1, 5), cols: P('每排', 2, 60, 1, 8), gap: P('间距', 0.7, 3, 0.05, 1), backless: PB('无靠背', false) },
    build(p) {
      const g = new THREE.Group();
      for (let r = 0; r < p.rows; r++) {
        for (let c = 0; c < p.cols; c++) {
          addChair(g, (c - (p.cols - 1) / 2) * p.gap, (r - (p.rows - 1) / 2) * p.gap, 0, p.backless);
        }
      }
      return g;
    }
  },
  roundtable: {
    name: '仅圆桌', cat: '单桌单椅', icon: '桌',
    params: { radius: P('半径', 0.6, 6, 0.1, 1), color: PC('桌色', TABLE_WHITE) },
    build(p) {
      const g = new THREE.Group();
      g.add(cyl(p.radius, p.radius, 0.06, dynMat(p.color), 0, 0.74, 0, 32));
      g.add(cyl(0.08, 0.12, 0.72, C.metal, 0, 0.36, 0));
      g.add(cyl(p.radius * 0.6, p.radius * 0.6, 0.04, C.metal, 0, 0.05, 0));
      return g;
    }
  },
  longtable: {
    name: '仅长桌', cat: '单桌单椅', icon: '桌',
    params: { length: P('长度', 2, 60, 0.5, 5), width: P('宽度', 0.8, 8, 0.1, 1.1), color: PC('桌色', TABLE_WHITE) },
    build(p) {
      const g = new THREE.Group();
      g.add(box(p.length, 0.07, p.width, dynMat(p.color), 0, 0.74, 0));
      for (const x of [-p.length / 2 + 0.3, p.length / 2 - 0.3])
        for (const z of [-p.width / 2 + 0.15, p.width / 2 - 0.15])
          g.add(box(0.08, 0.7, 0.08, C.dark, x, 0.35, z));
      return g;
    }
  },
  arch: {
    name: '花艺拱门', cat: '装饰', icon: '拱',
    params: { width: P('宽度', 2, 40, 0.5, 5), height: P('高度', 2, 20, 0.5, 3.4), color: PC('配色', '#c62828') },
    build(p) {
      const g = new THREE.Group();
      const pts = [];
      for (let i = 0; i <= 26; i++) {
        const a = (i / 26) * Math.PI;
        pts.push(new THREE.Vector3(-Math.cos(a) * p.width / 2, 0.16 + (p.height - 0.16) * Math.sin(a), 0));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const mat = dynMat(p.color);
      const soft = tintMat(p.color, 0.45);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.09, 8, false), mat);
      tube.castShadow = true;
      g.add(tube);
      for (const x of [-p.width / 2, p.width / 2]) g.add(box(0.14, 0.16, 0.14, C.metal, x, 0.08, 0));
      // 密集花簇 + 垂坠花枝 + 柱脚花艺，呈现饱满的仪式拱门
      for (let i = 1; i < 26; i++) {
        const pt = curve.getPoint(i / 26);
        for (let j = 0; j < 3; j++) {
          const a = j * 2.1 + i * 0.7;
          const off = 0.13 + (j % 2) * 0.07;
          const flowerMat = j === 1 ? soft : mat;
          g.add(ball(0.13 + (j === 0 ? 0.04 : 0), flowerMat,
            pt.x + Math.cos(a) * off, pt.y + Math.sin(a) * off * 0.7 - 0.09, Math.sin(a) * off));
        }
        if (i % 3 === 0) g.add(ball(0.1, soft, pt.x, pt.y - 0.3, 0.06));
      }
      for (const x of [-p.width / 2, p.width / 2]) {
        for (let j = 0; j < 6; j++) {
          const a = j * 1.05;
          g.add(ball(0.17, j % 2 ? soft : mat, x + Math.cos(a) * 0.2, 0.3 + Math.sin(a) * 0.18, Math.sin(a) * 0.2));
        }
      }
      return g;
    }
  },
  floral: {
    name: '花艺', cat: '装饰', icon: '花',
    params: { size: P('体量', 0.4, 8, 0.1, 0.9), color: PC('主色', '#c62828') },
    build(p) {
      const g = new THREE.Group();
      const petal = dynMat(p.color);
      const soft = tintMat(p.color, 0.45);
      g.add(cyl(0.16, 0.2, 0.36, C.wood, 0, 0.18, 0));
      for (let i = 0; i < 10; i++) {
        const a = i * 2.399;
        const rad = 0.1 + 0.19 * Math.sqrt(i);
        const y = 0.4 + p.size * 0.55 + Math.sin(i * 1.7) * 0.13;
        g.add(ball(p.size * (0.19 + (i % 3) * 0.03), i % 4 === 0 ? soft : petal, Math.cos(a) * rad, y, Math.sin(a) * rad));
      }
      return g;
    }
  },
  balloon: {
    name: '气球组', cat: '装饰', icon: '球',
    params: { count: P('数量', 3, 40, 1, 7), height: P('高度', 1.5, 20, 0.1, 2.4), color: PC('主色', '#c62828') },
    build(p) {
      const g = new THREE.Group();
      const mat = dynMat(p.color, 0.55);
      const soft = tintMat(p.color, 0.45);
      const points = [];
      for (let i = 0; i < p.count; i++) {
        const a = i * 2.399;
        const rad = 0.12 * Math.sqrt(i + 1);
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        const y = p.height - (i % 4) * 0.22;
        g.add(ball(0.18, i % 3 === 0 ? soft : mat, x, y, z));
        points.push(x, y - 0.18, z, x * 0.4, 0.02, z * 0.4);
      }
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      g.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.7 })));
      g.add(cyl(0.14, 0.18, 0.12, C.metal, 0, 0.06, 0));
      return g;
    }
  },
  spotlight: {
    name: '射灯', cat: '有柱灯具', icon: '灯',
    params: { height: P('灯架高', 1.5, 30, 0.1, 3.2), color: PC('灯罩色', '#ffe2b8') },
    build(p) {
      const g = new THREE.Group();
      g.add(cyl(0.05, 0.07, p.height, C.metal, 0, p.height / 2, 0));
      g.add(box(0.5, 0.04, 0.05, C.metal, 0, 0.02, 0));
      g.add(box(0.05, 0.04, 0.5, C.metal, 0, 0.02, 0));
      const head = new THREE.Group();
      head.position.set(0, p.height, 0);
      head.rotation.x = Math.PI / 4;
      head.add(box(0.34, 0.28, 0.34, C.dark, 0, 0, 0));
      const lens = cyl(0.13, 0.13, 0.03, lensMat(p.color), 0, 0, 0.19, 20);
      lens.rotation.x = Math.PI / 2;
      head.add(lens);
      g.add(head);
      return g;
    }
  },
  floodlight: {
    name: '面光灯', cat: '有柱灯具', icon: '面',
    params: { height: P('高度', 1.5, 30, 0.1, 3.2), width: P('宽度', 0.8, 10, 0.1, 1.6), color: PC('灯罩色', '#fff0d6') },
    build(p) {
      const g = new THREE.Group();
      g.add(cyl(0.05, 0.07, p.height, C.metal, 0, p.height / 2, 0));
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        const leg = box(0.05, 0.05, 0.65, C.metal, Math.cos(a) * 0.28, 0.03, Math.sin(a) * 0.28);
        leg.rotation.y = -a;
        g.add(leg);
      }
      const panel = new THREE.Group();
      panel.position.set(0, p.height, 0);
      panel.rotation.x = 0.18;
      panel.add(box(p.width, 0.5, 0.12, C.dark, 0, 0, 0));
      panel.add(box(p.width - 0.08, 0.42, 0.02, lensMat(p.color), 0, 0, 0.07));
      g.add(panel);
      return g;
    }
  },
  followspot: {
    name: '追光灯', cat: '有柱灯具', icon: '追',
    params: { height: P('高度', 2, 30, 0.1, 4.2), color: PC('灯罩色', '#ffffff') },
    build(p) {
      const g = new THREE.Group();
      g.add(cyl(0.06, 0.09, p.height, C.metal, 0, p.height / 2, 0));
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        const leg = box(0.05, 0.05, 0.7, C.metal, Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3);
        leg.rotation.y = -a;
        g.add(leg);
      }
      const head = new THREE.Group();
      head.position.set(0, p.height, 0);
      head.rotation.x = 0.5;
      const body = cyl(0.22, 0.28, 0.9, C.dark, 0, 0, 0, 20);
      body.rotation.x = Math.PI / 2;
      head.add(body);
      const lens = cyl(0.19, 0.19, 0.03, lensMat(p.color), 0, 0, 0.48, 20);
      lens.rotation.x = Math.PI / 2;
      head.add(lens);
      g.add(head);
      return g;
    }
  },
  spots: {
    name: '四头聚光', cat: '有柱灯具', icon: '聚',
    params: { height: P('高度', 2, 30, 0.1, 3.6), color: PC('灯罩色', '#ffe9c9') },
    build(p) {
      const g = new THREE.Group();
      g.add(cyl(0.05, 0.07, p.height, C.metal, 0, p.height / 2, 0));
      g.add(box(0.5, 0.04, 0.05, C.metal, 0, 0.02, 0));
      g.add(box(0.05, 0.04, 0.5, C.metal, 0, 0.02, 0));
      g.add(box(1.6, 0.08, 0.08, C.metal, 0, p.height, 0));
      for (let i = 0; i < 4; i++) {
        const x = -0.6 + i * 0.4;
        const head = new THREE.Group();
        head.position.set(x, p.height - 0.16, 0);
        head.rotation.x = 0.35;
        head.add(box(0.22, 0.2, 0.22, C.dark, 0, 0, 0));
        const lens = cyl(0.09, 0.09, 0.02, lensMat(p.color), 0, 0, 0.13, 16);
        lens.rotation.x = Math.PI / 2;
        head.add(lens);
        g.add(head);
      }
      return g;
    }
  },
  uplight: {
    name: '地排灯', cat: '有柱灯具', icon: '地',
    params: { height: P('高度', 0.8, 10, 0.1, 1.4), count: P('灯头', 2, 30, 1, 4), color: PC('灯罩色', '#ffd9a8') },
    build(p) {
      const g = new THREE.Group();
      g.add(cyl(0.06, 0.08, p.height, C.metal, 0, p.height / 2, 0));
      g.add(cyl(0.25, 0.3, 0.06, C.metal, 0, 0.03, 0));
      for (let i = 0; i < p.count; i++) {
        const a = (i / p.count) * Math.PI * 2;
        const head = new THREE.Group();
        head.position.set(Math.cos(a) * 0.12, p.height, Math.sin(a) * 0.12);
        head.rotation.y = -a;
        head.rotation.x = -0.35;
        const can = cyl(0.11, 0.13, 0.28, C.dark, 0, 0, 0, 16);
        can.rotation.x = Math.PI / 2;
        head.add(can);
        const lens = cyl(0.1, 0.1, 0.02, lensMat(p.color), 0, 0, 0.16, 16);
        lens.rotation.x = Math.PI / 2;
        head.add(lens);
        g.add(head);
      }
      return g;
    }
  },
  trusslight: {
    name: '灯排架', cat: '有柱灯具', icon: '排',
    params: { width: P('跨度', 3, 80, 0.5, 8), height: P('高度', 2.5, 30, 0.5, 4.5), color: PC('灯罩色', '#e8f0ff') },
    build(p) {
      const g = new THREE.Group();
      for (const x of [-p.width / 2, p.width / 2]) {
        g.add(cyl(0.06, 0.08, p.height, C.metal, x, p.height / 2, 0));
        g.add(cyl(0.3, 0.35, 0.06, C.metal, x, 0.03, 0));
      }
      g.add(box(p.width, 0.1, 0.1, C.metal, 0, p.height, 0));
      const count = Math.max(3, Math.round(p.width / 1.6));
      for (let i = 0; i < count; i++) {
        const x = -p.width / 2 + (i + 0.5) * (p.width / count);
        g.add(box(0.22, 0.22, 0.22, C.dark, x, p.height - 0.16, 0));
        const lens = cyl(0.09, 0.09, 0.02, lensMat(p.color), x, p.height - 0.16, 0.13, 16);
        lens.rotation.x = Math.PI / 2;
        g.add(lens);
      }
      return g;
    }
  },
  downlight: {
    name: '筒灯', cat: '无柱灯具', icon: '筒',
    params: { height: P('安装高', 2.5, 40, 0.1, 4.8), radius: P('口径', 0.1, 2, 0.05, 0.2), color: PC('灯罩色', '#fff2d8') },
    build(p) {
      const g = new THREE.Group();
      g.add(cyl(p.radius, p.radius, 0.22, C.dark, 0, p.height, 0, 20));
      g.add(cyl(p.radius * 0.85, p.radius * 0.85, 0.02, lensMat(p.color), 0, p.height - 0.12, 0, 20));
      return g;
    }
  },
  tracklight: {
    name: '轨道灯', cat: '无柱灯具', icon: '轨',
    params: { height: P('安装高', 2.5, 40, 0.1, 4.8), length: P('长度', 2, 60, 0.5, 6), color: PC('灯罩色', '#ffe9cc') },
    build(p) {
      const g = new THREE.Group();
      g.add(box(p.length, 0.08, 0.08, C.dark, 0, p.height, 0));
      const count = Math.max(2, Math.round(p.length / 1.6));
      for (let i = 0; i < count; i++) {
        const x = -p.length / 2 + (i + 0.5) * (p.length / count);
        const head = new THREE.Group();
        head.position.set(x, p.height - 0.12, 0);
        head.rotation.x = -0.25;
        head.add(cyl(0.11, 0.13, 0.28, C.dark, 0, 0, 0, 16));
        head.add(cyl(0.09, 0.09, 0.02, lensMat(p.color), 0, -0.16, 0, 16));
        g.add(head);
      }
      return g;
    }
  },
  pendant: {
    name: '吊灯', cat: '无柱灯具', icon: '吊',
    params: { height: P('吊点高', 3, 40, 0.1, 5.5), size: P('灯罩', 0.3, 6, 0.1, 0.7), color: PC('灯罩色', '#ffdfae') },
    build(p) {
      const g = new THREE.Group();
      const drop = Math.min(1.4, p.height - 1);
      g.add(cyl(0.02, 0.02, drop, C.metal, 0, p.height - drop / 2, 0, 8));
      const y = p.height - drop;
      const shade = new THREE.Mesh(new THREE.ConeGeometry(p.size, 0.5, 24, 1, true), C.dark);
      shade.rotation.z = Math.PI;
      shade.position.set(0, y, 0);
      g.add(shade);
      g.add(ball(p.size * 0.35, lensMat(p.color), 0, y - 0.18, 0));
      return g;
    }
  },
  ledstrip: {
    name: '灯带', cat: '无柱灯具', icon: '带',
    params: { width: P('宽度', 2, 80, 0.5, 10), depth: P('长度', 2, 60, 0.5, 8), height: P('离地', 0.05, 30, 0.05, 0.1), color: PC('灯罩色', '#bfe4ff') },
    build(p) {
      const g = new THREE.Group();
      const m = lensMat(p.color);
      g.add(box(p.width, 0.03, 0.05, m, 0, p.height, -p.depth / 2));
      g.add(box(p.width, 0.03, 0.05, m, 0, p.height, p.depth / 2));
      g.add(box(0.05, 0.03, p.depth, m, -p.width / 2, p.height, 0));
      g.add(box(0.05, 0.03, p.depth, m, p.width / 2, p.height, 0));
      return g;
    }
  },
  parcan: {
    name: '帕灯', cat: '无柱灯具', icon: '帕',
    params: { color: PC('灯罩色', '#ffb27a'), size: P('口径', 0.2, 3, 0.05, 0.35) },
    build(p) {
      const g = new THREE.Group();
      g.add(cyl(p.size * 1.2, p.size * 1.2, 0.04, C.metal, 0, 0.02, 0, 20));
      g.add(cyl(p.size, p.size, 0.4, C.dark, 0, 0.22, 0, 20));
      g.add(cyl(p.size * 0.9, p.size * 0.9, 0.03, lensMat(p.color), 0, 0.43, 0, 20));
      return g;
    }
  },
  movinghead: {
    name: '摇头灯', cat: '无柱灯具', icon: '摇',
    params: { color: PC('灯罩色', '#d8ecff'), size: P('功率', 0.2, 3, 0.05, 0.35) },
    build(p) {
      const g = new THREE.Group();
      g.add(box(0.5, 0.18, 0.5, C.dark, 0, 0.09, 0));
      const head = new THREE.Group();
      head.position.set(0, 0.35, 0);
      head.rotation.x = 0.6;
      head.add(box(0.36, 0.3, 0.36, C.dark, 0, 0, 0));
      const lens = cyl(p.size, p.size, 0.03, lensMat(p.color), 0, 0, 0.2, 20);
      lens.rotation.x = Math.PI / 2;
      head.add(lens);
      g.add(head);
      return g;
    }
  },
  partition: {
    name: '隔断墙', cat: '装饰', icon: '墙',
    params: { width: P('宽度', 1.5, 40, 0.5, 3), height: P('高度', 1.5, 20, 0.5, 2.6), color: PC('颜色', '#eceae5') },
    build(p) {
      const g = new THREE.Group();
      g.add(box(p.width, p.height, 0.12, dynMat(p.color), 0, p.height / 2 + 0.1, 0));
      g.add(box(p.width, 0.08, 0.5, C.metal, 0, 0.04, 0));
      return g;
    }
  },
  frame: {
    name: '画框', cat: '装饰', icon: '画',
    params: { width: P('宽度', 0.6, 12, 0.1, 1.2), height: P('高度', 0.8, 20, 0.1, 1.6), color: PC('画面', '#cfc7b8') },
    build(p) {
      const g = new THREE.Group();
      g.add(box(p.width, p.height, 0.06, C.dark, 0, p.height / 2 + 0.16, 0));
      g.add(box(p.width - 0.12, p.height - 0.12, 0.02, dynMat(p.color), 0, p.height / 2 + 0.16, 0.04));
      g.add(box(0.07, 0.32, 0.07, C.dark, 0, 0.16, 0));
      g.add(box(0.42, 0.05, 0.3, C.dark, 0, 0.025, 0));
      return g;
    }
  },
  pedestal: {
    name: '展台', cat: '装饰', icon: '座',
    params: { size: P('边长', 0.4, 6, 0.1, 0.7), height: P('高度', 0.5, 6, 0.1, 1) },
    build(p) {
      const g = new THREE.Group();
      g.add(box(p.size, p.height, p.size, C.white, 0, p.height / 2, 0));
      g.add(ball(p.size * 0.22, C.accent, 0, p.height + p.size * 0.2, 0));
      return g;
    }
  },
  carpet: {
    name: '地毯', cat: '装饰', icon: '毯',
    params: {
      width: P('宽度', 1, 60, 0.5, 3), depth: P('长度', 1, 100, 0.5, 8),
      base: P('离地', 0, 10, 0.1, 0), color: PC('颜色', '#d9d4ca')
    },
    build(p) {
      const g = new THREE.Group();
      const mat = dynMat(p.color, 0.95);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.width, p.depth), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = (p.base || 0) + 0.014;
      mesh.receiveShadow = true;
      g.add(mesh);
      return g;
    }
  },
  dessert: {
    name: '甜品台', cat: '装饰', icon: '甜',
    params: {
      width: P('宽度', 1.5, 30, 0.5, 3), height: P('台面高', 0.6, 5, 0.1, 0.85),
      color: PC('桌色', TABLE_WHITE)
    },
    build(p) {
      const g = new THREE.Group();
      const cloth = dynMat(p.color, 0.9);
      const cake = dynMat('#e8b8ae', 0.7);
      const cream = dynMat('#fff8f0', 0.7);
      g.add(box(p.width, p.height, 0.9, cloth, 0, p.height / 2, 0));
      g.add(box(p.width + 0.1, 0.05, 1, C.white, 0, p.height + 0.025, 0));
      // 主蛋糕与双层甜点
      g.add(cyl(0.24, 0.24, 0.32, cake, -p.width * 0.28, p.height + 0.19, 0, 20));
      g.add(cyl(0.26, 0.26, 0.03, cream, -p.width * 0.28, p.height + 0.36, 0, 20));
      g.add(cyl(0.16, 0.16, 0.24, cream, p.width * 0.06, p.height + 0.15, -0.08, 20));
      g.add(ball(0.09, C.accent, p.width * 0.06, p.height + 0.3, -0.08));
      // 甜品盘阵列
      for (let i = 0; i < 5; i++) {
        const x = -p.width * 0.4 + i * (p.width * 0.8 / 4);
        g.add(cyl(0.11, 0.11, 0.02, C.white, x, p.height + 0.07, 0.3, 16));
        g.add(ball(0.06, i % 2 ? C.accent : C.wood, x, p.height + 0.12, 0.3));
      }
      g.add(ball(0.2, C.cream, p.width * 0.38, p.height + 0.22, 0));
      g.add(ball(0.12, C.white, p.width * 0.38 - 0.12, p.height + 0.28, 0.04));
      return g;
    }
  }
};

/* 单桌单椅：仅椅子（单人座 / 5 座 / 10 人座 / 20 人座），其余旧规格隐藏以兼容历史方案 */
function makeSeatModule(n) {
  const defaultCols = n <= 4 ? n : (n <= 10 ? Math.ceil(n / 2) : 5);
  return {
    name: n === 1 ? '单人座' : n === 2 ? '双人座' : `${n}人座`,
    cat: '单桌单椅', icon: String(n),
    people: n,
    params: { cols: P('每排', 1, n, 1, defaultCols), gap: P('间距', 0.7, 3, 0.05, 0.95), backless: PB('无靠背', false) },
    build(p) {
      const cols = clamp(Math.round(p.cols), 1, n);
      const rows = Math.ceil(n / cols);
      const g = new THREE.Group();
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const inRow = Math.min(cols, n - row * cols);
        addChair(g, (col - (inRow - 1) / 2) * p.gap, (row - (rows - 1) / 2) * p.gap, 0, p.backless);
      }
      return g;
    }
  };
}
const SIMPLE_SEATS = [1, 5, 10, 20];
for (let n = 1; n <= 20; n++) {
  const mod = makeSeatModule(n);
  if (!SIMPLE_SEATS.includes(n)) mod.hidden = true;
  MODULES['seat' + n] = mod;
}

/* 圆桌桌椅套装：1–20 人全部采用圆桌 + 环绕座椅 */
function makeSeatSetModule(n) {
  return {
    name: n === 1 ? '圆桌单人套装' : n === 2 ? '圆桌双人套装' : `圆桌${n}人套装`,
    cat: '圆桌桌椅套装', icon: String(n), people: n,
    params: {
      gap: P('椅距', 0.7, 3, 0.05, 0.95),
      table: P('桌面半径', 0.6, 8, 0.1, clamp(0.6 + n * 0.09, 0.6, 3)),
      color: PC('桌色', TABLE_WHITE),
      backless: PB('无靠背', false)
    },
    build(p) {
      const g = new THREE.Group();
      const r = clamp(p.table, 0.6, 8);
      g.add(cyl(r, r, 0.06, dynMat(p.color), 0, 0.74, 0, 40));
      g.add(cyl(0.08, 0.12, 0.72, C.metal, 0, 0.36, 0));
      g.add(cyl(r * 0.55, r * 0.55, 0.04, C.metal, 0, 0.05, 0));
      if (r > 1.6) {
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2;
          g.add(cyl(0.06, 0.06, 0.72, C.metal, Math.cos(a) * r * 0.6, 0.36, Math.sin(a) * r * 0.6, 10));
        }
      }
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const dist = r + 0.25 + p.gap * 0.18;
        addChair(g, Math.cos(a) * dist, Math.sin(a) * dist, Math.PI / 2 - a, p.backless);
      }
      return g;
    }
  };
}
for (let n = 1; n <= 20; n++) MODULES['set' + n] = makeSeatSetModule(n);

/* 长桌桌椅套装：1–20 人，长桌两侧排椅，桌长随人数与椅距变化 */
function makeLongSeatSetModule(n) {
  const perSide = Math.ceil(n / 2);
  return {
    name: n === 1 ? '长桌单人套装' : n === 2 ? '长桌双人套装' : `长桌${n}人套装`,
    cat: '长桌桌椅套装', icon: String(n), people: n,
    params: {
      gap: P('椅距', 0.7, 3, 0.05, 0.95),
      width: P('桌宽', 0.8, 8, 0.1, 1.1),
      color: PC('桌色', TABLE_WHITE),
      backless: PB('无靠背', false)
    },
    build(p) {
      const gap = clamp(p.gap, 0.7, 3);
      const width = clamp(p.width, 0.8, 8);
      const length = clamp(perSide * gap + 0.5, 2, 40);
      const g = new THREE.Group();
      g.add(box(length, 0.07, width, dynMat(p.color), 0, 0.74, 0));
      for (const x of [-length / 2 + 0.3, length / 2 - 0.3])
        for (const z of [-width / 2 + 0.15, width / 2 - 0.15])
          g.add(box(0.08, 0.7, 0.08, C.dark, x, 0.35, z));
      const front = Math.ceil(n / 2);
      for (let i = 0; i < front; i++) {
        const x = front === 1 ? 0 : (i - (front - 1) / 2) * gap;
        addChair(g, x, width / 2 + 0.33, 0, p.backless);
      }
      const back = n - front;
      for (let i = 0; i < back; i++) {
        const x = back === 1 ? 0 : (i - (back - 1) / 2) * gap;
        addChair(g, x, -width / 2 - 0.33, Math.PI, p.backless);
      }
      return g;
    }
  };
}
for (let n = 1; n <= 20; n++) MODULES['longset' + n] = makeLongSeatSetModule(n);

const CATS = ['全部', ...new Set(Object.values(MODULES).filter(m => !m.hidden).map(m => m.cat))];

/* ---------- templates ---------- */
// 让灯具朝向场地中央：局部 +Z 是灯头方向，按摆位计算 Y 轴旋转
const AIM_CENTER = (x, z) => Math.atan2(-x, -z);
const TEMPLATES = {
  wedding: {
    name: '婚礼', venue: { w: 30, d: 22, h: 5.5 },
    items: [
      // T 型舞台与台阶
      { type: 'tstage', pos: { x: 0, z: -6 }, params: { width: 12, depth: 3.5, runway: 10, runwayWidth: 3.2, height: 0.5, color: '#a81f24' } },
      { type: 'stairs', pos: { x: 0, z: 3.8 }, params: { width: 3.2, height: 0.5, steps: 3, color: '#a81f24' } },
      // 分段地毯：主台 / T 台 / 地面延伸全部红色
      { type: 'carpet', pos: { x: 0, z: -7.75 }, params: { width: 10.5, depth: 3.4, base: 0.6, color: '#c62828' } },
      { type: 'carpet', pos: { x: 0, z: -1 }, params: { width: 2.8, depth: 9.8, base: 0.6, color: '#c62828' } },
      { type: 'carpet', pos: { x: 0, z: 6.8 }, params: { width: 3, depth: 3.6, base: 0, color: '#c62828' } },
      { type: 'ledstrip', pos: { x: 0, z: -1 }, params: { width: 3.4, depth: 9.8, height: 0.63, color: '#c9a97f' } },
      // 仪式背景：中央大屏 + 左右两侧小屏，替代原隔断墙
      { type: 'screenTruss', pos: { x: 0, z: -9.8 }, params: { width: 10, height: 4.5, base: 0.6, color: '#2a1f22', depth: 0.3 } },
      { type: 'screenTruss', pos: { x: -9.5, z: -9.8 }, params: { width: 3.4, height: 2.6, base: 1.1, color: '#2a1f22', depth: 0.3 } },
      { type: 'screenTruss', pos: { x: 9.5, z: -9.8 }, params: { width: 3.4, height: 2.6, base: 1.1, color: '#2a1f22', depth: 0.3 } },
      // 花艺拱门移到入口（场地前侧中央，正对 T 台通道），两侧配气球组
      { type: 'arch', pos: { x: 0, z: 9.6 }, params: { width: 6, height: 4, color: '#c62828' } },
      { type: 'balloon', pos: { x: -3.8, z: 9.6 }, params: { count: 8, height: 2.4, color: '#c62828' } },
      { type: 'balloon', pos: { x: 3.8, z: 9.6 }, params: { count: 8, height: 2.4, color: '#c62828' } },
      { type: 'floral', pos: { x: -4.5, z: -8.6 }, params: { size: 1.4, color: '#c62828' } },
      { type: 'floral', pos: { x: 4.5, z: -8.6 }, params: { size: 1.4, color: '#c62828' } },
      { type: 'balloon', pos: { x: -8.5, z: -8.8 }, params: { count: 12, height: 3.4, color: '#c62828' } },
      { type: 'balloon', pos: { x: 8.5, z: -8.8 }, params: { count: 12, height: 3.4, color: '#c62828' } },
      { type: 'pedestal', pos: { x: -2, z: -9.2 }, params: { size: 0.6, height: 1 } },
      { type: 'pedestal', pos: { x: 2, z: -9.2 }, params: { size: 0.6, height: 1 } },
      { type: 'floral', pos: { x: -2.6, z: 0 }, params: { size: 1, color: '#e57373' } },
      { type: 'floral', pos: { x: 2.6, z: 0 }, params: { size: 1, color: '#e57373' } },
      { type: 'floral', pos: { x: -2.6, z: 3 }, params: { size: 1, color: '#e57373' } },
      { type: 'floral', pos: { x: 2.6, z: 3 }, params: { size: 1, color: '#e57373' } },
      // 甜品台（两侧签到区，不占用中央通道）
      { type: 'dessert', pos: { x: -11, z: -5 }, params: { width: 3, height: 0.85, color: '#efe2d8' } },
      { type: 'dessert', pos: { x: 11, z: -5 }, params: { width: 3, height: 0.85, color: '#efe2d8' } },
      // 宴席圆桌（12 桌，全部带椅）
      { type: 'set8', pos: { x: -10, z: -2 }, params: { gap: 0.95, table: 1.35 } },
      { type: 'set8', pos: { x: -5, z: -2 }, params: { gap: 0.95, table: 1.35 } },
      { type: 'set8', pos: { x: 5, z: -2 }, params: { gap: 0.95, table: 1.35 } },
      { type: 'set8', pos: { x: 10, z: -2 }, params: { gap: 0.95, table: 1.35 } },
      { type: 'set8', pos: { x: -10, z: 3 }, params: { gap: 0.95, table: 1.35 } },
      { type: 'set8', pos: { x: -5, z: 3 }, params: { gap: 0.95, table: 1.35 } },
      { type: 'set8', pos: { x: 5, z: 3 }, params: { gap: 0.95, table: 1.35 } },
      { type: 'set8', pos: { x: 10, z: 3 }, params: { gap: 0.95, table: 1.35 } },
      { type: 'set8', pos: { x: -10, z: 8 }, params: { gap: 0.95, table: 1.35 } },
      { type: 'set8', pos: { x: -5, z: 8 }, params: { gap: 0.95, table: 1.35 } },
      { type: 'set8', pos: { x: 5, z: 8 }, params: { gap: 0.95, table: 1.35 } },
      { type: 'set8', pos: { x: 10, z: 8 }, params: { gap: 0.95, table: 1.35 } },
      // 顶部灯饰与灯具（仅实体造型）
      { type: 'pendant', pos: { x: -3.5, z: -8 }, params: { height: 4.8, size: 0.7, color: '#f0d9b5' } },
      { type: 'pendant', pos: { x: 3.5, z: -8 }, params: { height: 4.8, size: 0.7, color: '#f0d9b5' } },
      { type: 'trusslight', pos: { x: 0, z: -9 }, params: { width: 11, height: 5, color: '#f0d9b5' } },
      { type: 'uplight', pos: { x: -7.5, z: -9 }, params: { height: 1.2, count: 6, color: '#e8c8a0' } },
      { type: 'uplight', pos: { x: 7.5, z: -9 }, params: { height: 1.2, count: 6, color: '#e8c8a0' } },
      // 射灯布在场地四角并朝向中央，避免挡住舞台正前方
      { type: 'spotlight', pos: { x: -13, z: -9 }, rot: AIM_CENTER(-13, -9), params: { height: 4.2, color: '#f0d9b5' } },
      { type: 'spotlight', pos: { x: 13, z: -9 }, rot: AIM_CENTER(13, -9), params: { height: 4.2, color: '#f0d9b5' } },
      { type: 'spotlight', pos: { x: -13, z: 9 }, rot: AIM_CENTER(-13, 9), params: { height: 4.2, color: '#f0d9b5' } },
      { type: 'spotlight', pos: { x: 13, z: 9 }, rot: AIM_CENTER(13, 9), params: { height: 4.2, color: '#f0d9b5' } }
    ]
  },
  launch: {
    name: '新品发布会', venue: { w: 30, d: 22, h: 6 },
    items: [
      { type: 'stage', pos: { x: 0, z: -8 }, params: { width: 14, depth: 4.5, height: 0.75 } },
      // LED 屏放在舞台最里侧，与无灯桁架成套，桁架藏在屏后方
      { type: 'screenTruss', pos: { x: 0, z: -10 }, params: { width: 12, height: 4, base: 0.8, color: '#1b2b3a', depth: 0.3 } },
      { type: 'podium', pos: { x: 3.6, z: -6.8 }, h: 0.75, params: { width: 1.1, height: 1.15 } },
      { type: 'seat20', pos: { x: -6, z: 1 }, params: { cols: 10, gap: 1 } },
      { type: 'seat20', pos: { x: 6, z: 1 }, params: { cols: 10, gap: 1 } },
      { type: 'seat20', pos: { x: -6, z: 4.2 }, params: { cols: 10, gap: 1 } },
      { type: 'seat20', pos: { x: 6, z: 4.2 }, params: { cols: 10, gap: 1 } },
      // 射灯布在场地四角并朝向中央，避免挡住舞台正前方
      { type: 'spotlight', pos: { x: -13, z: -9 }, rot: AIM_CENTER(-13, -9), params: { height: 4.2, color: '#dbe8ff' } },
      { type: 'spotlight', pos: { x: 13, z: -9 }, rot: AIM_CENTER(13, -9), params: { height: 4.2, color: '#dbe8ff' } },
      { type: 'spotlight', pos: { x: -13, z: 9 }, rot: AIM_CENTER(-13, 9), params: { height: 4.2, color: '#dbe8ff' } },
      { type: 'spotlight', pos: { x: 13, z: 9 }, rot: AIM_CENTER(13, 9), params: { height: 4.2, color: '#dbe8ff' } }
    ]
  },
  gallery: {
    name: '艺术展览', venue: { w: 24, d: 18, h: 5 },
    items: [
      { type: 'partition', pos: { x: -6, z: -3 }, rot: 0, params: { width: 5, height: 2.8, color: '#eceae5' } },
      { type: 'partition', pos: { x: 5, z: -1 }, rot: Math.PI / 2, params: { width: 5, height: 2.8, color: '#eceae5' } },
      { type: 'partition', pos: { x: -3, z: 4.5 }, rot: 0, params: { width: 4.5, height: 2.8, color: '#e6e3dc' } },
      { type: 'frame', pos: { x: -6, z: -2 }, params: { width: 1.4, height: 1.8, color: '#cfc7b8' } },
      { type: 'frame', pos: { x: 5, z: 0.5 }, rot: Math.PI / 2, params: { width: 1.6, height: 2, color: '#b9c1bd' } },
      { type: 'frame', pos: { x: -3, z: 5.5 }, params: { width: 1.3, height: 1.7, color: '#c9c2b4' } },
      { type: 'pedestal', pos: { x: -2, z: -5 }, params: { size: 0.7, height: 1 } },
      { type: 'pedestal', pos: { x: 0.5, z: -5 }, params: { size: 0.8, height: 1.1 } },
      { type: 'pedestal', pos: { x: 3, z: -5 }, params: { size: 0.6, height: 0.9 } },
      { type: 'pedestal', pos: { x: 7, z: -5 }, params: { size: 0.8, height: 1.05 } },
      // 射灯布在场地四角并朝向中央
      { type: 'spotlight', pos: { x: -10.5, z: -7.5 }, rot: AIM_CENTER(-10.5, -7.5), params: { height: 3.4, color: '#fff0d8' } },
      { type: 'spotlight', pos: { x: 10.5, z: -7.5 }, rot: AIM_CENTER(10.5, -7.5), params: { height: 3.4, color: '#fff0d8' } },
      { type: 'spotlight', pos: { x: -10.5, z: 7.5 }, rot: AIM_CENTER(-10.5, 7.5), params: { height: 3.4, color: '#fff0d8' } },
      { type: 'spotlight', pos: { x: 10.5, z: 7.5 }, rot: AIM_CENTER(10.5, 7.5), params: { height: 3.4, color: '#fff0d8' } }
    ]
  },
  gala: {
    name: '企业年会', venue: { w: 32, d: 24, h: 6.5 },
    items: [
      { type: 'stage', pos: { x: 0, z: -9 }, params: { width: 16, depth: 5, height: 0.8 } },
      // LED 屏放在舞台最里侧，与无灯桁架成套，桁架藏在屏后方
      { type: 'screenTruss', pos: { x: 0, z: -11.2 }, params: { width: 14, height: 4.4, base: 0.85, color: '#202c3b', depth: 0.3 } },
      { type: 'podium', pos: { x: -4.5, z: -7.5 }, h: 0.8, params: { width: 1.1, height: 1.15 } },
      { type: 'set8', pos: { x: -9, z: -3 }, params: { gap: 0.95, table: 1.2 } },
      { type: 'set8', pos: { x: 0, z: -3 }, params: { gap: 0.95, table: 1.2 } },
      { type: 'set8', pos: { x: 9, z: -3 }, params: { gap: 0.95, table: 1.2 } },
      { type: 'set8', pos: { x: -9, z: 3 }, params: { gap: 0.95, table: 1.2 } },
      { type: 'set8', pos: { x: 0, z: 3 }, params: { gap: 0.95, table: 1.2 } },
      { type: 'set8', pos: { x: 9, z: 3 }, params: { gap: 0.95, table: 1.2 } },
      { type: 'set8', pos: { x: -9, z: 9 }, params: { gap: 0.95, table: 1.2 } },
      { type: 'set8', pos: { x: 0, z: 9 }, params: { gap: 0.95, table: 1.2 } },
      { type: 'set8', pos: { x: 9, z: 9 }, params: { gap: 0.95, table: 1.2 } },
      // 射灯布在场地四角并朝向中央，避免挡住舞台正前方
      { type: 'spotlight', pos: { x: -14, z: -10 }, rot: AIM_CENTER(-14, -10), params: { height: 4.6, color: '#ffd9b0' } },
      { type: 'spotlight', pos: { x: 14, z: -10 }, rot: AIM_CENTER(14, -10), params: { height: 4.6, color: '#ffd9b0' } },
      { type: 'spotlight', pos: { x: -14, z: 10 }, rot: AIM_CENTER(-14, 10), params: { height: 4.6, color: '#ffd9b0' } },
      { type: 'spotlight', pos: { x: 14, z: 10 }, rot: AIM_CENTER(14, 10), params: { height: 4.6, color: '#ffd9b0' } }
    ]
  }
};

/* ---------- state & three.js setup ---------- */
const state = {
  venue: { w: 30, d: 22, h: 6 }, floorColor: '#d8d8d4', hideWalls: false, hideGrid: false, desaturate: false,
  modules: [], groups: [], selected: null, selectedGroup: null, multi: [],
  template: null, filter: '全部',
  view: 'persp', preview: false
};
let uid = 0;
let gid = 0;

const canvas = document.getElementById('scene');
const stageEl = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// r128 默认线性输出，色彩更接近设计稿的克制灰白关系
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf1f1ee);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI * 0.495;

scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d9d2, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 0.7);
sun.position.set(9, 16, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 220;
sun.shadow.bias = -0.0005;
scene.add(sun);

const venueGroup = new THREE.Group();
const moduleRoot = new THREE.Group();
scene.add(venueGroup, moduleRoot);
let floorMesh = null;
const boxHelper = new THREE.Box3Helper(new THREE.Box3(), 0xb45b3a);
boxHelper.visible = false;
boxHelper.material.depthTest = false;
scene.add(boxHelper);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let drag = null;

/* ---------- geometry builders ---------- */
function disposeGroup(group) {
  group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => { if (!SHARED.has(m)) m.dispose(); });
    }
  });
}

function makeGrid(w, d) {
  const pts = [];
  for (let x = -Math.floor(w / 2); x <= w / 2 + 0.001; x += 1) pts.push(x, 0.008, -d / 2, x, 0.008, d / 2);
  for (let z = -Math.floor(d / 2); z <= d / 2 + 0.001; z += 1) pts.push(-w / 2, 0.008, z, w / 2, 0.008, z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  // 网格线随地面明度自动反向，浅色地面压暗、深色地面提亮
  const base = new THREE.Color(state.floorColor);
  const lum = 0.299 * base.r + 0.587 * base.g + 0.114 * base.b;
  const lineColor = lum > 0.5 ? base.clone().multiplyScalar(0.86) : base.clone().lerp(new THREE.Color(0xffffff), 0.4);
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: 0.9 }));
}

function buildVenue() {
  while (venueGroup.children.length) {
    const child = venueGroup.children[0];
    venueGroup.remove(child);
    disposeGroup(child);
  }
  const { w, d, h } = state.venue;
  floorMesh = box(w, 0.04, d, C.floor, 0, -0.02, 0);
  floorMesh.castShadow = false;
  venueGroup.add(floorMesh);
  if (!state.hideGrid) venueGroup.add(makeGrid(w, d));

  if (!state.hideWalls) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, roughness: 1, depthWrite: false });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    back.position.set(0, h / 2, -d / 2);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(d, h), wallMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-w / 2, h / 2, 0);
    venueGroup.add(back, left);
  }
  // 线框边界始终保留，便于看清空间轮廓
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    new THREE.LineBasicMaterial({ color: 0xccccc5, transparent: true, opacity: 0.75 })
  );
  edges.position.y = h / 2;
  venueGroup.add(edges);

  state.modules.forEach(mod => {
    mod.pos.x = clamp(mod.pos.x, -w / 2, w / 2);
    mod.pos.z = clamp(mod.pos.z, -d / 2, d / 2);
    if (mod.group) mod.group.position.set(mod.pos.x, mod.h || 0, mod.pos.z);
  });
  updateSelectionBox();
  updateMeta();
}

/* ---------- module operations ---------- */
const getModule = id => state.modules.find(m => m.id === id);
const getSelected = () => getModule(state.selected);
const getGroup = id => state.groups.find(g => g.id === id);
const getSelectedGroup = () => state.selectedGroup === null ? null : getGroup(state.selectedGroup);
const isLocked = m => {
  if (!m) return false;
  if (m.locked) return true;
  const g = m.groupId ? getGroup(m.groupId) : null;
  return !!g && !!g.locked;
};
const selectedIds = () => {
  const ids = state.multi.slice();
  if (state.selected !== null && !ids.includes(state.selected)) ids.push(state.selected);
  return ids;
};

function addModule(type, opts = {}) {
  const def = MODULES[type];
  if (!def) return null;
  const params = {};
  for (const [k, v] of Object.entries(def.params)) params[k] = opts.params && opts.params[k] !== undefined ? opts.params[k] : v.value;
  // 旧方案的射灯/泡灯数量合并为新的间隔灯具总数
  if (type === 'trusslights' && opts.params && (opts.params.arms !== undefined || opts.params.bulbs !== undefined)) {
    params.count = clamp(Math.round((opts.params.arms || 0) + (opts.params.bulbs || 0)), 0, 40);
  }
  const gId = opts.groupId && getGroup(opts.groupId) ? opts.groupId : null;
  const mod = {
    id: opts.id !== undefined ? opts.id : ++uid, type, name: def.name, params,
    pos: { x: opts.pos ? opts.pos.x : 0, z: opts.pos ? opts.pos.z : 0 },
    h: opts.h || 0,
    rot: opts.rot || 0, scale: opts.scale || 1, group: null,
    locked: !!opts.locked, groupId: gId
  };
  state.modules.push(mod);
  rebuildModule(mod);
  renderList();
  updateMeta();
  updateEmpty();
  return mod;
}

function rebuildModule(mod) {
  if (mod.group) {
    moduleRoot.remove(mod.group);
    disposeGroup(mod.group);
  }
  const g = MODULES[mod.type].build(mod.params);
  g.userData.moduleId = mod.id;
  g.position.set(mod.pos.x, mod.h || 0, mod.pos.z);
  g.rotation.y = mod.rot;
  g.scale.setScalar(mod.scale);
  moduleRoot.add(g);
  mod.group = g;
  if (state.selected === mod.id) updateSelectionBox();
}

function removeModule(id, force = false) {
  const idx = state.modules.findIndex(m => m.id === id);
  if (idx < 0) return;
  const mod = state.modules[idx];
  if (!force && isLocked(mod)) { toast('模组已锁定，请先解锁'); return; }
  moduleRoot.remove(mod.group);
  disposeGroup(mod.group);
  state.modules.splice(idx, 1);
  if (mod.groupId) {
    const g = getGroup(mod.groupId);
    if (g) {
      g.memberIds = g.memberIds.filter(x => x !== id);
      if (!g.memberIds.length) state.groups = state.groups.filter(x => x.id !== g.id);
    }
  }
  state.multi = state.multi.filter(x => x !== id);
  if (state.selected === id) selectModule(null);
  else { renderList(); updateToolButtons(); updateSelectionBox(); }
  updateMeta();
  updateEmpty();
}

function clearModules() {
  while (moduleRoot.children.length) {
    const child = moduleRoot.children[0];
    moduleRoot.remove(child);
    disposeGroup(child);
  }
  state.modules = [];
  state.groups = [];
  state.multi = [];
  state.selectedGroup = null;
  selectModule(null);
  renderList();
  updateMeta();
  updateEmpty();
}

/* ---------- lock & group operations ---------- */
function toggleLock(id) {
  const mod = getModule(id);
  if (!mod) return;
  if (mod.groupId) {
    const g = getGroup(mod.groupId);
    if (g && g.locked) { toast('组合已锁定，请先解锁组合'); return; }
  }
  mod.locked = !mod.locked;
  if (mod.locked) state.multi = state.multi.filter(x => x !== id);
  renderList(); renderProps(); updateSelectionBox(); updateToolButtons();
  toast(mod.locked ? '模组已锁定' : '模组已解锁');
}

function toggleGroupLock(id) {
  const g = getGroup(id);
  if (!g) return;
  g.locked = !g.locked;
  renderList(); renderProps(); updateToolButtons();
  toast(g.locked ? '组合已锁定' : '组合已解锁');
}

function groupSelected() {
  const ids = selectedIds().filter(id => {
    const m = getModule(id);
    return m && !m.groupId && !isLocked(m);
  });
  if (ids.length < 2) { toast('请选择至少 2 个未锁定的模组'); return; }
  const g = { id: ++gid, name: '组合 ' + gid, memberIds: ids.slice(), locked: false, collapsed: false };
  state.groups.push(g);
  ids.forEach(id => { getModule(id).groupId = g.id; });
  state.multi = [];
  state.selected = null;
  state.selectedGroup = g.id;
  renderList(); renderProps(); updateSelectionBox(); updateToolButtons();
  toast(`已将 ${ids.length} 个模组组合`);
}

function ungroup(groupIds) {
  const ids = groupIds.filter(id => !!getGroup(id));
  if (!ids.length) return;
  ids.forEach(gidValue => {
    const g = getGroup(gidValue);
    g.memberIds.forEach(mid => { const m = getModule(mid); if (m) m.groupId = null; });
  });
  state.groups = state.groups.filter(g => !ids.includes(g.id));
  if (state.selectedGroup !== null && ids.includes(state.selectedGroup)) state.selectedGroup = null;
  renderList(); renderProps(); updateSelectionBox(); updateToolButtons();
  toast('已解散组合');
}

function ungroupSelected() {
  const ids = [];
  if (state.selectedGroup !== null) ids.push(state.selectedGroup);
  selectedIds().forEach(id => {
    const m = getModule(id);
    if (m && m.groupId && !ids.includes(m.groupId)) ids.push(m.groupId);
  });
  ungroup(ids);
}

function applyTemplate(key) {
  const t = TEMPLATES[key];
  if (!t) return;
  state.venue = { ...t.venue };
  state.template = key;
  updateDimInputs();
  buildVenue();
  clearModules();
  t.items.forEach(item => addModule(item.type, { params: item.params, pos: item.pos, h: item.h || 0, rot: item.rot || 0 }));
  selectModule(null);
  renderTemplates();
  fitView();
  toast(`已套用「${t.name}」模板`);
}

function updateSelectionBox() {
  const box = new THREE.Box3();
  let any = false;
  let ids = [];
  if (state.selectedGroup !== null) {
    const g = getGroup(state.selectedGroup);
    if (g) ids = g.memberIds.slice();
  } else {
    ids = selectedIds();
  }
  ids.forEach(id => {
    const m = getModule(id);
    if (m && m.group) { box.expandByObject(m.group); any = true; }
  });
  if (!any || box.isEmpty()) { boxHelper.visible = false; return; }
  boxHelper.box.copy(box);
  boxHelper.visible = true;
}

function selectModule(id, additive = false) {
  if (additive && id !== null) {
    if (state.selected !== null && !state.multi.includes(state.selected)) state.multi.push(state.selected);
    const i = state.multi.indexOf(id);
    if (i >= 0) state.multi.splice(i, 1);
    else state.multi.push(id);
    state.selected = state.multi.length ? state.multi[state.multi.length - 1] : null;
    state.selectedGroup = null;
  } else {
    state.multi = [];
    state.selected = id;
    state.selectedGroup = null;
  }
  renderList();
  renderProps();
  updateSelectionBox();
  updateToolButtons();
}

function selectGroup(id) {
  state.selectedGroup = id;
  state.selected = null;
  state.multi = [];
  renderList();
  renderProps();
  updateSelectionBox();
  updateToolButtons();
}

function updateToolButtons() {
  const mods = selectedIds().map(getModule).filter(Boolean);
  $('btn-group').disabled = !(mods.length >= 2 && mods.every(m => !m.groupId && !isLocked(m)));
  let groupIds = [];
  if (state.selectedGroup !== null) groupIds.push(state.selectedGroup);
  mods.forEach(m => { if (m.groupId && !groupIds.includes(m.groupId)) groupIds.push(m.groupId); });
  $('btn-ungroup').disabled = !groupIds.some(id => !!getGroup(id));
}

/* ---------- UI rendering ---------- */
const $ = id => document.getElementById(id);
let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
}

function updateMeta() {
  const { w, d, h } = state.venue;
  $('meta').textContent = `${w} × ${d} × ${h} m · ${state.modules.length} 个模组${state.groups.length ? ' · ' + state.groups.length + ' 组' : ''}`;
  $('count').textContent = `${state.modules.length} 个`;
}
function updateEmpty() {
  $('empty-tip').classList.toggle('hidden', state.modules.length > 0);
}
// 去色优先级最高：直接对画布做灰度滤镜，任何模组换色都不影响最终显示
function applyDesaturate() {
  canvas.style.filter = state.desaturate ? 'grayscale(1)' : '';
}

function updateDimInputs() {
  ['w', 'd', 'h'].forEach(k => {
    $('dim-' + k).value = state.venue[k];
    $('num-' + k).value = state.venue[k];
  });
  $('hide-walls').checked = !!state.hideWalls;
  $('hide-grid').checked = !!state.hideGrid;
  $('desaturate').checked = !!state.desaturate;
  applyDesaturate();
}

function setFloorColor(hex, rebuild = true) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  state.floorColor = hex.toLowerCase();
  C.floor.color.set(state.floorColor);
  $('floor-color').value = state.floorColor;
  $('floor-color-val').textContent = state.floorColor.toUpperCase();
  document.querySelectorAll('[data-floor]').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.floor.toLowerCase() === state.floorColor)
  );
  if (rebuild) buildVenue();
}

function renderTemplates() {
  document.querySelectorAll('[data-tpl]').forEach(btn => btn.classList.toggle('active', btn.dataset.tpl === state.template));
}

function renderChips() {
  $('chips').innerHTML = CATS.map(c => `<button class="chip ${c === state.filter ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');
  $('chips').querySelectorAll('[data-cat]').forEach(btn => btn.addEventListener('click', () => {
    state.filter = btn.dataset.cat;
    renderChips();
    renderModuleGrid();
  }));
}

function renderModuleGrid() {
  const list = Object.entries(MODULES).filter(([, def]) => !def.hidden && (state.filter === '全部' || def.cat === state.filter));
  $('mod-grid').innerHTML = list.map(([type, def]) =>
    `<button class="mod" data-add="${type}" title="添加${def.name}"><i>${def.icon}</i><span>${def.name}</span></button>`
  ).join('');
  $('mod-grid').querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => {
    const n = state.modules.length;
    const mod = addModule(btn.dataset.add, { pos: { x: (n % 4) * 0.7 - 1.05, z: (n % 3) * 0.7 - 0.7 } });
    selectModule(mod.id);
    toast(`已添加「${mod.name}」，可拖拽或编辑尺寸`);
  }));
}

const lockIcon = on => on
  ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="7" width="10" height="7" rx="1.4"/><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2"/></svg>'
  : '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="7" width="10" height="7" rx="1.4"/><path d="M5.2 7V5a2.8 2.8 0 0 1 5.4-1"/></svg>';

function layerItemHTML(m, i, child = false) {
  const locked = isLocked(m);
  const active = state.selected === m.id || state.multi.includes(m.id);
  const cls = ['item', child ? 'child' : '', active ? 'active' : '', state.multi.includes(m.id) ? 'multi' : '', locked ? 'locked' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}" data-id="${m.id}">
    <span class="label"><span class="index">${child ? '' : String(i + 1).padStart(2, '0')}</span>${m.name}${m.locked ? ' · 锁' : ''}</span>
    <span class="item-actions">
      <button class="lock ${locked ? 'on' : ''}" data-lock="${m.id}" title="${m.locked ? '解锁' : '锁定'}">${lockIcon(m.locked)}</button>
      <button class="del" data-del="${m.id}" title="删除">×</button>
    </span>
  </div>`;
}

function renderList() {
  const list = $('list');
  updateToolButtons();
  if (!state.modules.length) {
    list.innerHTML = '<div class="empty">还没有模组，从模组库添加或套用模板</div>';
    return;
  }
  const seen = new Set();
  let html = '';
  state.modules.forEach((m, i) => {
    if (!m.groupId || !getGroup(m.groupId)) { html += layerItemHTML(m, i); return; }
    const g = getGroup(m.groupId);
    if (!seen.has(g.id)) {
      seen.add(g.id);
      const active = state.selectedGroup === g.id;
      html += `<div class="item group ${active ? 'active' : ''} ${g.locked ? 'locked' : ''}" data-group="${g.id}">
        <span class="label"><span class="index">G${state.groups.indexOf(g) + 1}</span>${g.name} · ${g.memberIds.length} 个</span>
        <span class="item-actions">
          <button class="fold" data-gtoggle="${g.id}" title="${g.collapsed ? '展开成员' : '收起成员'}">${g.collapsed ? '▸' : '▾'}</button>
          <button class="lock ${g.locked ? 'on' : ''}" data-glock="${g.id}" title="${g.locked ? '解锁组合' : '锁定组合'}">${lockIcon(g.locked)}</button>
          <button class="ungroup" data-gungroup="${g.id}" title="解散组合">拆</button>
        </span>
      </div>`;
    }
    if (!g.collapsed) html += layerItemHTML(m, i, true);
  });
  list.innerHTML = html;

  list.querySelectorAll('[data-group]').forEach(el => el.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn) {
      if (btn.dataset.gtoggle) {
        const g = getGroup(Number(btn.dataset.gtoggle));
        if (g) { g.collapsed = !g.collapsed; renderList(); }
      } else if (btn.dataset.glock) toggleGroupLock(Number(btn.dataset.glock));
      else if (btn.dataset.gungroup) ungroup([Number(btn.dataset.gungroup)]);
      return;
    }
    selectGroup(Number(el.dataset.group));
  }));
  list.querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn) {
      if (btn.dataset.lock) toggleLock(Number(btn.dataset.lock));
      else if (btn.dataset.del) removeModule(Number(btn.dataset.del));
      return;
    }
    selectModule(Number(el.dataset.id), e.ctrlKey || e.metaKey);
  }));
}

function propRange(key, label, min, max, step, value, group) {
  const attr = group ? `data-${group}` : 'data-param';
  return `<div class="prop-row"><label>${label}</label>\
    <input type="range" ${attr}="${key}" min="${min}" max="${max}" step="${step}" value="${value}">\
    <input type="number" class="num" ${attr}="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}

function propCheck(key, label, checked) {
  return `<div class="prop-check"><label><input type="checkbox" data-param="${key}" ${checked ? 'checked' : ''}>${label}</label></div>`;
}

// 同一个属性行的滑条与数字框联动：滑条实时同步，数字框输入时不打断键入，失焦时归位
function linkNumeric(root, selector, onChange) {
  const inputs = [...root.querySelectorAll(selector)];
  const range = inputs.find(i => i.type === 'range');
  const num = inputs.find(i => i.type === 'number');
  if (!range || !num) return;
  const bound = () => ({ min: parseFloat(range.min), max: parseFloat(range.max) });
  const apply = (raw, source) => {
    if (!Number.isFinite(raw)) return;
    const { min, max } = bound();
    const v = clamp(raw, min, max);
    if (source !== 'num') num.value = v;
    if (source !== 'range') range.value = v;
    onChange(v);
  };
  range.addEventListener('input', () => apply(parseFloat(range.value), 'range'));
  num.addEventListener('input', () => apply(parseFloat(num.value), 'num'));
  num.addEventListener('change', () => {
    const { min, max } = bound();
    const raw = parseFloat(num.value);
    const v = Number.isFinite(raw) ? clamp(raw, min, max) : parseFloat(range.value);
    num.value = v;
    apply(v, 'change');
  });
}

// 将模型值写回同一属性的滑条与数字框
function setNumeric(root, selector, value) {
  root.querySelectorAll(selector).forEach(inp => {
    inp.value = clamp(value, parseFloat(inp.min), parseFloat(inp.max));
  });
}

function renderGroupProps(box, g) {
  const members = g.memberIds.map(getModule).filter(Boolean);
  if (!members.length) {
    box.innerHTML = '<div class="empty">组合为空</div>';
    return;
  }
  const centerOf = list => ({
    x: list.reduce((s, m) => s + m.pos.x, 0) / list.length,
    z: list.reduce((s, m) => s + m.pos.z, 0) / list.length
  });
  const snapshot = () => {
    const cur = g.memberIds.map(getModule).filter(Boolean);
    return {
      center: centerOf(cur),
      list: cur.map(m => ({ id: m.id, x: m.pos.x, z: m.pos.z, rot: m.rot }))
    };
  };
  // 固定基准：进入属性面板时的状态，编辑过程中不变；滑条值表示相对该基准的绝对变换量
  const base = snapshot();
  const tf = { x: 0, z: 0, deg: 0 };
  const applyTransform = () => {
    const rad = tf.deg * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    base.list.forEach(rec => {
      const m = getModule(rec.id);
      if (!m) return;
      const ox = rec.x - base.center.x, oz = rec.z - base.center.z;
      m.pos.x = clamp(base.center.x + ox * cos - oz * sin + tf.x, -state.venue.w / 2, state.venue.w / 2);
      m.pos.z = clamp(base.center.z + ox * sin + oz * cos + tf.z, -state.venue.d / 2, state.venue.d / 2);
      m.rot = rec.rot + rad;
      m.group.position.set(m.pos.x, m.h || 0, m.pos.z);
      m.group.rotation.y = m.rot;
    });
    updateSelectionBox();
  };
  let html = `<div class="prop-title">${g.name}<span>${members.length} 个模组</span></div>`;
  if (g.locked) {
    html += '<div class="locked-note">该组合已锁定，整体位置与旋转不可编辑。</div>';
  } else {
    html += propRange('x', 'X 位置', -state.venue.w / 2, state.venue.w / 2, 0.1, base.center.x, 'gpos');
    html += propRange('z', 'Z 位置', -state.venue.d / 2, state.venue.d / 2, 0.1, base.center.z, 'gpos');
    html += propRange('rot', '整体旋转', -720, 720, 5, 0, 'grot');
  }
  html += `<button class="btn" id="btn-propg-lock">${g.locked ? '解锁组合' : '锁定组合'}</button>`;
  html += '<button class="btn" id="btn-propg-ungroup">解散组合</button>';
  html += '<button class="btn danger" id="btn-propg-delete">删除整组</button>';
  box.innerHTML = html;

  ['x', 'z'].forEach(axis => {
    linkNumeric(box, `input[data-gpos="${axis}"]`, target => {
      if (g.locked) return;
      // 滑条为绝对坐标：与旋转共用一个固定基准，先应用已设旋转，再平移到目标中心
      tf[axis] = target - base.center[axis];
      applyTransform();
    });
  });
  linkNumeric(box, 'input[data-grot]', deg => {
    if (g.locked) return;
    tf.deg = deg;
    applyTransform();
  });
  $('btn-propg-lock').addEventListener('click', () => toggleGroupLock(g.id));
  $('btn-propg-ungroup').addEventListener('click', () => ungroup([g.id]));
  $('btn-propg-delete').addEventListener('click', () => {
    g.memberIds.slice().forEach(id => removeModule(id, true));
    state.groups = state.groups.filter(x => x.id !== g.id);
    selectModule(null);
    toast('已删除整组');
  });
}

function renderProps() {
  const box = $('props');
  const group = getSelectedGroup();
  if (group) { renderGroupProps(box, group); return; }
  if (state.multi.length > 1) {
    box.innerHTML = `<div class="prop-title">已选 ${state.multi.length} 个模组<span>多选</span></div>
      <div class="locked-note">点击「组合」将它们设为一组，可整体移动与旋转。</div>
      <button class="btn" id="btn-prop-group">组合所选</button>`;
    $('btn-prop-group').addEventListener('click', groupSelected);
    return;
  }
  const mod = getSelected();
  if (!mod) {
    box.innerHTML = '<div class="empty">点击场景或列表中的模组，调整尺寸与位置</div>';
    return;
  }
  if (isLocked(mod)) {
    box.innerHTML = `<div class="prop-title">${mod.name}<span>已锁定</span></div>
      <div class="locked-note">该模组已锁定，不能移动、删除或编辑参数。</div>
      <button class="btn" id="btn-unlock">解锁模组</button>
      ${mod.groupId ? '<button class="btn danger" id="btn-prop-ungroup">解散所属组合</button>' : ''}`;
    $('btn-unlock').addEventListener('click', () => toggleLock(mod.id));
    if (mod.groupId) $('btn-prop-ungroup').addEventListener('click', () => ungroup([mod.groupId]));
    return;
  }
  let html = `<div class="prop-title">${mod.name}<span>#${String(mod.id).padStart(2, '0')}${mod.groupId ? ' · 已组合' : ''}</span></div>`;
  for (const [key, def] of Object.entries(MODULES[mod.type].params)) {
    if (def.type === 'color') {
      html += `<div class="prop-row"><label>${def.label}</label><input type="color" data-param="${key}" value="${mod.params[key]}"><span class="val"></span></div>`;
    } else if (def.type === 'bool') {
      html += propCheck(key, def.label, !!mod.params[key]);
    } else {
      html += propRange(key, def.label, def.min, def.max, def.step, mod.params[key]);
    }
  }
  html += propRange('x', 'X 位置', -state.venue.w / 2, state.venue.w / 2, 0.1, mod.pos.x, 'pos');
  html += propRange('z', 'Z 位置', -state.venue.d / 2, state.venue.d / 2, 0.1, mod.pos.z, 'pos');
  html += propRange('h', 'H 高度', 0, 10, 0.05, mod.h || 0, 'h');
  html += propRange('rot', '旋转', -720, 720, 5, Math.round(mod.rot * 180 / Math.PI), 'rot');
  html += propRange('scale', '整体缩放', 0.2, 6, 0.05, mod.scale, 'scale');
  html += '<button class="btn" id="btn-lock">锁定该模组</button>';
  html += '<button class="btn danger" id="btn-delete">删除该模组</button>';
  box.innerHTML = html;

  // 颜色项：滑条行没有数字框，单独绑定
  box.querySelectorAll('input[type="color"][data-param]').forEach(inp => {
    inp.addEventListener('input', () => {
      mod.params[inp.dataset.param] = inp.value;
      rebuildModule(mod);
    });
  });
  // 勾选项：切换后立即重建模型
  box.querySelectorAll('input[type="checkbox"][data-param]').forEach(inp => {
    inp.addEventListener('change', () => {
      mod.params[inp.dataset.param] = inp.checked;
      rebuildModule(mod);
    });
  });
  // 数值参数、位置、旋转、缩放：每个属性一行，滑条与数字框联动
  Object.keys(MODULES[mod.type].params).forEach(key => {
    const def = MODULES[mod.type].params[key];
    if (def.type === 'color' || def.type === 'bool') return;
    linkNumeric(box, `input[data-param="${key}"]`, v => {
      mod.params[key] = v;
      rebuildModule(mod);
    });
  });
  linkNumeric(box, 'input[data-pos="x"]', v => {
    mod.pos.x = v;
    mod.group.position.set(mod.pos.x, mod.h || 0, mod.pos.z);
    updateSelectionBox();
  });
  linkNumeric(box, 'input[data-pos="z"]', v => {
    mod.pos.z = v;
    mod.group.position.set(mod.pos.x, mod.h || 0, mod.pos.z);
    updateSelectionBox();
  });
  linkNumeric(box, 'input[data-h]', v => {
    mod.h = v;
    mod.group.position.set(mod.pos.x, mod.h, mod.pos.z);
    updateSelectionBox();
  });
  linkNumeric(box, 'input[data-rot]', deg => {
    mod.rot = deg * Math.PI / 180;
    mod.group.rotation.y = mod.rot;
    updateSelectionBox();
  });
  linkNumeric(box, 'input[data-scale]', v => {
    mod.scale = v;
    mod.group.scale.setScalar(v);
    updateSelectionBox();
  });
  $('btn-lock').addEventListener('click', () => toggleLock(mod.id));
  $('btn-delete').addEventListener('click', () => removeModule(mod.id));
}

function syncPropValues(mod) {
  const box = $('props');
  Object.keys(MODULES[mod.type].params).forEach(key => {
    const def = MODULES[mod.type].params[key];
    if (def.type === 'range') setNumeric(box, `input[data-param="${key}"]`, mod.params[key]);
  });
  setNumeric(box, 'input[data-pos="x"]', mod.pos.x);
  setNumeric(box, 'input[data-pos="z"]', mod.pos.z);
  setNumeric(box, 'input[data-h]', mod.h || 0);
  setNumeric(box, 'input[data-rot]', Math.round(mod.rot * 180 / Math.PI));
  setNumeric(box, 'input[data-scale]', mod.scale);
}

/* ---------- camera & interaction ---------- */
function fitView() {
  const { w, d, h } = state.venue;
  const s = Math.max(w, d);
  camera.position.set(s * 0.72, Math.max(h * 2, s * 0.62), s * 0.95);
  controls.target.set(0, h * 0.22, 0);
  controls.update();
}
function refreshViewButtons() {
  document.querySelectorAll('[data-view]').forEach(b => {
    b.classList.toggle('active', !state.preview && b.dataset.view === state.view);
  });
  const previewBtn = $('btn-preview');
  if (previewBtn) {
    previewBtn.classList.toggle('active', state.preview);
    previewBtn.setAttribute('aria-pressed', String(state.preview));
  }
}
function setView(view) {
  const { w, d, h } = state.venue;
  state.view = view;
  if (view === 'top') {
    camera.position.set(0, Math.max(w, d) * 1.25, 0.001);
    controls.target.set(0, 0, 0);
  } else if (view === 'front') {
    camera.position.set(0, h * 0.9, d * 1.55);
    controls.target.set(0, h * 0.3, 0);
  } else {
    fitView();
  }
  controls.update();
  // 预览优先级最高：切换视角只改镜头，不退出预览
  refreshViewButtons();
}

function cancelDrag() {
  if (!drag) return;
  if (drag.pointerId !== undefined && canvas.hasPointerCapture(drag.pointerId)) {
    canvas.releasePointerCapture(drag.pointerId);
  }
  drag = null;
  controls.enabled = true;
}
function setPreviewMode(on) {
  state.preview = !!on;
  if (state.preview) {
    // 进入预览时取消拖拽与选中，避免残留编辑状态
    cancelDrag();
    selectModule(null);
  } else {
    cancelDrag();
  }
  controls.enabled = true;
  $('stage').classList.toggle('preview-mode', state.preview);
  $('stage-hint').textContent = state.preview
    ? '预览模式 · 任意位置拖拽旋转 · 右键拖拽平移 · 滚轮缩放 · 再次点击预览退出'
    : 'Ctrl 多选 · 拖拽移动 · 空白处旋转 · 滚轮缩放 · Delete 删除';
  refreshViewButtons();
  toast(state.preview ? '已进入预览模式，拖拽不会移动物体' : '已退出预览模式');
}

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}
function pickModule(e) {
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(moduleRoot.children, true);
  for (const hit of hits) {
    let o = hit.object;
    while (o && o !== moduleRoot) {
      if (o.userData.moduleId) {
        const mod = getModule(o.userData.moduleId);
        if (mod && !isLocked(mod)) return o;
        break;
      }
      o = o.parent;
    }
  }
  return null;
}
function floorPoint(e) {
  if (!floorMesh) return null;
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(floorMesh, false);
  return hits.length ? hits[0].point : null;
}

canvas.addEventListener('pointerdown', e => {
  // 预览模式优先级最高：完全跳过拾取与模组拖拽，直接交给视角控制器
  if (state.preview) return;
  if (e.button !== 0) return;
  const additive = e.ctrlKey || e.metaKey;
  const obj = pickModule(e);
  if (obj) {
    const mod = getModule(obj.userData.moduleId);
    selectModule(mod.id, additive);
    if (additive) return;
    const p = floorPoint(e);
    if (p) {
      const ids = [];
      if (mod.groupId) {
        const g = getGroup(mod.groupId);
        if (g) g.memberIds.forEach(id => ids.push(id));
      }
      state.multi.forEach(id => { if (!ids.includes(id)) ids.push(id); });
      const movable = ids.filter(id => { const m = getModule(id); return m && !isLocked(m); });
      drag = { id: mod.id, dx: mod.pos.x - p.x, dz: mod.pos.z - p.z, ids: movable.length ? movable : [mod.id], pointerId: e.pointerId };
      controls.enabled = false;
      canvas.setPointerCapture(e.pointerId);
    }
  } else {
    selectModule(null);
  }
});
canvas.addEventListener('pointermove', e => {
  if (state.preview) return;
  if (!drag) return;
  const p = floorPoint(e);
  if (!p) return;
  const mod = getModule(drag.id);
  if (!mod) return;
  const nextX = clamp(p.x + drag.dx, -state.venue.w / 2, state.venue.w / 2);
  const nextZ = clamp(p.z + drag.dz, -state.venue.d / 2, state.venue.d / 2);
  const dx = nextX - mod.pos.x, dz = nextZ - mod.pos.z;
  drag.ids.forEach(id => {
    const m = getModule(id);
    if (!m || isLocked(m)) return;
    m.pos.x = clamp(m.pos.x + dx, -state.venue.w / 2, state.venue.w / 2);
    m.pos.z = clamp(m.pos.z + dz, -state.venue.d / 2, state.venue.d / 2);
    m.group.position.set(m.pos.x, m.h || 0, m.pos.z);
    syncPropValues(m);
  });
  updateSelectionBox();
});
const endDrag = () => cancelDrag();
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

window.addEventListener('keydown', e => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  // 预览模式下不响应删除，避免预览时误改场景
  if (state.preview) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedGroup !== null) {
      const g = getGroup(state.selectedGroup);
      if (g) {
        e.preventDefault();
        g.memberIds.slice().forEach(id => removeModule(id, true));
        state.groups = state.groups.filter(x => x.id !== g.id);
        selectModule(null);
        toast('已删除整组');
      }
    } else if (selectedIds().length) {
      e.preventDefault();
      selectedIds().forEach(id => removeModule(id));
    }
  }
});

/* ---------- persistence & export ---------- */
function sceneData() {
  return {
    venue: { ...state.venue },
    floorColor: state.floorColor,
    hideWalls: !!state.hideWalls,
    hideGrid: !!state.hideGrid,
    desaturate: !!state.desaturate,
    groups: state.groups.map(g => ({ id: g.id, name: g.name, memberIds: g.memberIds.slice(), locked: !!g.locked, collapsed: !!g.collapsed })),
    modules: state.modules.map(m => ({
      id: m.id, type: m.type, params: m.params, pos: m.pos, h: m.h || 0, rot: m.rot, scale: m.scale,
      locked: !!m.locked, groupId: m.groupId
    }))
  };
}
function parseSceneData(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const data = parsed && parsed.scene && typeof parsed.scene === 'object' ? parsed.scene : parsed;
  if (!data || typeof data !== 'object' || Array.isArray(data) || !data.venue || !Array.isArray(data.modules)) {
    throw new Error('invalid scene');
  }
  const w = Number(data.venue.w), d = Number(data.venue.d), h = Number(data.venue.h);
  if (![w, d, h].every(Number.isFinite)) throw new Error('invalid venue');
  // 逐项清洗：损坏的模组/组合直接丢弃，避免个别非法条目让整个方案导入失败
  const usedIds = new Set();
  const modules = data.modules.filter(m => m && typeof m === 'object' && MODULES[m.type]).map(m => {
    let id = Number(m.id);
    if (!Number.isFinite(id) || usedIds.has(id)) id = ++uid;
    usedIds.add(id);
    const px = Number(m.pos && m.pos.x), pz = Number(m.pos && m.pos.z);
    const src = m.params && typeof m.params === 'object' ? m.params : {};
    const params = { ...src };
    for (const [k, def] of Object.entries(MODULES[m.type].params)) {
      let v = src[k];
      if (def.type === 'range') {
        v = Number(v);
        params[k] = Number.isFinite(v) ? clamp(v, def.min, def.max) : def.value;
      } else if (def.type === 'bool') {
        params[k] = !!v;
      } else if (def.type === 'color') {
        params[k] = typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : def.value;
      }
    }
    return {
      id, type: m.type, params,
      pos: { x: Number.isFinite(px) ? px : 0, z: Number.isFinite(pz) ? pz : 0 },
      h: clamp(Number(m.h) || 0, 0, 10),
      rot: Number.isFinite(Number(m.rot)) ? Number(m.rot) : 0,
      scale: clamp(Number(m.scale) || 1, 0.2, 6),
      locked: !!m.locked, groupId: m.groupId
    };
  });
  const groups = (Array.isArray(data.groups) ? data.groups : [])
    .filter(g => g && typeof g === 'object' && Number.isFinite(Number(g.id)))
    .map(g => ({
      id: Number(g.id),
      name: typeof g.name === 'string' && g.name ? g.name : '组合 ' + g.id,
      memberIds: Array.isArray(g.memberIds) ? g.memberIds.filter(x => usedIds.has(Number(x))).map(Number) : [],
      locked: !!g.locked, collapsed: !!g.collapsed
    }));
  const groupIds = new Set(groups.map(g => g.id));
  modules.forEach(m => { if (!groupIds.has(m.groupId)) m.groupId = null; });
  const floorColor = typeof data.floorColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(data.floorColor)
    ? data.floorColor.toLowerCase() : '#d8d8d4';
  return {
    venue: { w: clamp(w, 8, 120), d: clamp(d, 8, 100), h: clamp(h, 3, 30) },
    floorColor,
    hideWalls: !!data.hideWalls, hideGrid: !!data.hideGrid, desaturate: !!data.desaturate,
    groups, modules
  };
}
function applySceneData(raw, successText) {
  const data = parseSceneData(raw);
  if (state.preview) setPreviewMode(false);
  state.venue = { ...data.venue };
  state.template = null;
  state.hideWalls = !!data.hideWalls;
  state.hideGrid = !!data.hideGrid;
  state.desaturate = !!data.desaturate;
  setFloorColor(data.floorColor || '#d8d8d4', false);
  updateDimInputs();
  buildVenue();
  clearModules();
  state.groups = data.groups;
  gid = Math.max(0, ...state.groups.map(g => g.id));
  data.modules.forEach(m => addModule(m.type, {
    id: m.id, params: m.params, pos: m.pos, h: m.h || 0, rot: m.rot, scale: m.scale,
    locked: m.locked, groupId: m.groupId
  }));
  state.groups = state.groups.filter(g => g.memberIds.some(id => !!getModule(id)));
  uid = Math.max(uid, ...state.modules.map(m => m.id));
  selectModule(null);
  renderTemplates();
  fitView();
  toast(successText);
}
function saveScene() {
  localStorage.setItem('venuekit.scene', JSON.stringify(sceneData()));
  toast('方案已保存到本机');
}
function exportSceneFile() {
  const blob = new Blob([JSON.stringify(sceneData(), null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `场地方案-${state.venue.w}x${state.venue.d}m.json`;
  a.href = url;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('方案文件已导出');
}
function importSceneFile(file) {
  if (!file) return;
  if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
    toast('请选择 JSON 方案文件');
    $('file-import').value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      applySceneData(reader.result, '方案已导入');
    } catch (err) {
      toast('导入失败：文件格式不正确');
    }
    $('file-import').value = '';
  };
  reader.onerror = () => {
    toast('导入失败：无法读取文件');
    $('file-import').value = '';
  };
  reader.readAsText(file, 'utf-8');
}
function loadScene() {
  const raw = localStorage.getItem('venuekit.scene');
  if (!raw) { toast('还没有保存的方案'); return; }
  try {
    applySceneData(raw, '已读取本机方案');
  } catch (err) {
    toast('方案读取失败');
  }
}
function newScene() {
  if (!confirm('确定新建场景？当前未保存的修改会丢失。')) return;
  if (state.preview) setPreviewMode(false);
  state.venue = { w: 30, d: 22, h: 6 };
  state.floorColor = '#d8d8d4';
  state.hideWalls = false;
  state.hideGrid = false;
  state.desaturate = false;
  state.groups = [];
  state.template = null;
  uid = 0;
  gid = 0;
  clearModules();
  applyDesaturate();
  updateDimInputs();
  setFloorColor('#d8d8d4', false);
  setView('persp');
  selectModule(null);
  renderTemplates();
  toast('已新建空白场景');
}
function exportPNG() {
  renderer.render(scene, camera);
  const src = renderer.domElement;
  let url = src.toDataURL('image/png');
  if (state.desaturate) {
    // CSS 滤镜不会写进画布像素，导出时同步做一次灰度处理
    const tmp = document.createElement('canvas');
    tmp.width = src.width;
    tmp.height = src.height;
    const ctx = tmp.getContext('2d');
    ctx.filter = 'grayscale(1)';
    ctx.drawImage(src, 0, 0);
    url = tmp.toDataURL('image/png');
  }
  const a = document.createElement('a');
  a.download = `场地效果图-${state.venue.w}x${state.venue.d}m.png`;
  a.href = url;
  a.click();
  toast('效果图已导出');
}

/* ---------- bindings & boot ---------- */
// 左侧各分区点击标题即可展开 / 收纳
document.querySelectorAll('.block-head').forEach(head => {
  head.setAttribute('role', 'button');
  head.setAttribute('tabindex', '0');
  head.addEventListener('click', () => head.parentElement.classList.toggle('collapsed'));
  head.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); head.click(); }
  });
});

['w', 'd', 'h'].forEach(k => {
  const range = $('dim-' + k);
  const num = $('num-' + k);
  const limits = { min: parseFloat(range.min), max: parseFloat(range.max) };
  const handler = e => {
    const v = clamp(parseFloat(e.target.value), limits.min, limits.max);
    if (!Number.isFinite(v)) return;
    state.venue[k] = v;
    range.value = v;
    num.value = v;
    buildVenue();
    renderProps();
  };
  range.addEventListener('input', handler);
  num.addEventListener('change', handler);
});

$('floor-color').addEventListener('input', e => setFloorColor(e.target.value));
document.querySelectorAll('[data-floor]').forEach(btn => btn.addEventListener('click', () => setFloorColor(btn.dataset.floor)));
$('hide-walls').addEventListener('change', e => {
  state.hideWalls = e.target.checked;
  buildVenue();
});
$('hide-grid').addEventListener('change', e => {
  state.hideGrid = e.target.checked;
  buildVenue();
});
$('desaturate').addEventListener('change', e => {
  state.desaturate = e.target.checked;
  applyDesaturate();
});

document.querySelectorAll('[data-tpl]').forEach(btn => btn.addEventListener('click', () => applyTemplate(btn.dataset.tpl)));
document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
$('btn-preview').addEventListener('click', () => setPreviewMode(!state.preview));
$('btn-reset').addEventListener('click', () => { fitView(); setView('persp'); });
$('btn-group').addEventListener('click', groupSelected);
$('btn-ungroup').addEventListener('click', ungroupSelected);
$('btn-new').addEventListener('click', newScene);
$('btn-save').addEventListener('click', saveScene);
$('btn-load').addEventListener('click', loadScene);
$('btn-import').addEventListener('click', () => $('file-import').click());
$('file-import').addEventListener('change', e => importSceneFile(e.target.files && e.target.files[0]));
$('btn-export-scene').addEventListener('click', exportSceneFile);
$('btn-export').addEventListener('click', exportPNG);

const ro = new ResizeObserver(() => {
  const r = stageEl.getBoundingClientRect();
  if (!r.width || !r.height) return;
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  renderer.setSize(r.width, r.height, false);
});
ro.observe(stageEl);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

renderChips();
renderModuleGrid();
const params = new URLSearchParams(location.search);
const requestedTpl = params.get('tpl');
applyTemplate(TEMPLATES[requestedTpl] ? requestedTpl : 'launch');
setView('persp');
const requestedFloor = params.get('floor');
if (requestedFloor && /^#?[0-9a-fA-F]{6}$/.test(requestedFloor)) {
  setFloorColor(requestedFloor.startsWith('#') ? requestedFloor : '#' + requestedFloor);
}
animate();
