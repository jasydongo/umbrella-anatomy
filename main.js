/* 折叠雨伞 · 结构 3D 可视化
 * 三折伞机构：上巢(固定铰点) + 长骨 + 骨关节(尾骨) + 撑骨 + 下巢(滑套) 组成的连杆系统，
 * 中棒三节伸缩，开合参数 t ∈ [0,1] 驱动全部零件运动。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const RAD = Math.PI / 180;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/* ---------------- 机构参数 ---------------- */
const RIBS = 8;            // 伞骨数量
const A_IN = 15;           // 长骨长
const B_TIP = 15;          // 尾骨长
const C_ATT = 8;           // 撑骨与长骨铰接点到上巢的距离
const S_STR = 12;          // 撑骨长度
const PIVOT_R = 0.55;      // 上巢铰点半径
const TH_CLOSED = 3 * RAD;   // 收合时长骨与中棒(向下轴)夹角
const TH_OPEN = 68 * RAD;    // 展开时长骨张角
const FOLD_CLOSED = 174 * RAD; // 收合时尾骨回折角
const FOLD_OPEN = -10 * RAD;   // 展开时尾骨略下垂
const TOP_CLOSED = 32, TOP_OPEN = 44; // 上巢高度(中棒顶)

const SEG = [ // 三节中棒: [收合时底端, 展开时底端, 长度, 半径]
  [10.0, 10.0, 14, 0.46],
  [16.0, 23.0, 14, 0.40],
  [23.5, 35.0, 9, 0.34],
];

/* ---------------- 部件定义 ---------------- */
const DEFS = [
  { id: 'canopy', name: '伞面（伞布）', en: 'CANOPY', count: '1 张 · 8 片', mat: '碰击布 / 涂层涤纶', color: '#3a63cf',
    desc: '绷紧于伞骨之上的防水面料，挡雨主体。角部固定在骨尾珠、骨身缝扎于长骨，收伞时随骨架三段折叠成束。' },
  { id: 'ribs', name: '长骨（主骨）', en: 'MAIN RIB', count: '8 根', mat: '铝合金 / 玻纤', color: '#b9c1cc',
    desc: '骨架的承力主杆。根部铰接于上巢，中部与撑骨相连；开伞时被撑骨顶开至约 72°，撑出伞面的主体弧面。' },
  { id: 'tips', name: '尾骨（折叠骨）', en: 'FOLD RIB', count: '8 根', mat: '铝合金 / 玻纤', color: '#a8b1bf',
    desc: '长骨末段，经骨关节与长骨相连。开伞时延续伞面弧线下垂，收伞时绕关节向内回折约 174°，实现“三折”收纳。' },
  { id: 'joints', name: '骨关节（铆钉）', en: 'RIB HINGE', count: '8 处', mat: '钢铆钉 + 转轴', color: '#8f979f',
    desc: '连接长骨与尾骨的活动铰点。铆钉穿过两层骨片形成转轴，决定折叠动作的松紧与顺滑度，是三折伞的关键活动副。' },
  { id: 'stretchers', name: '撑骨（下骨）', en: 'STRETCHER', count: '8 根', mat: '铝合金', color: '#c6ced8',
    desc: '连接下巢与长骨的传力杆。推动下巢沿中棒滑动时，撑骨将轴向推力转换为长骨的张开角度，是开合的“传动连杆”。' },
  { id: 'runner', name: '下巢（滑巢）', en: 'RUNNER', count: '1 只', mat: 'POM 工程塑料', color: '#98a1ac',
    desc: '套在中棒上滑动的滑套，汇集 8 根撑骨的下端。开伞时被推向中棒上方、收伞时回落，是整伞开合的“操纵端”。' },
  { id: 'notch', name: '上巢（伞顶盘）', en: 'TOP NOTCH', count: '1 只', mat: 'POM 工程塑料', color: '#9aa3ae',
    desc: '固定在中棒顶端的圆盘，周向均布 8 个铰接耳，连接全部长骨根部；与下巢共同构成开合连杆机构的固定端。' },
  { id: 'shaft', name: '中棒（伞杆）', en: 'SHAFT', count: '1 支 · 3 节', mat: '铝合金阳极氧化', color: '#b4bcc6',
    desc: '三节伸缩套管结构，撑起整伞高度。开伞时各节依次锁定到位，收伞时回缩，把整伞长度压缩近三分之一。' },
  { id: 'spring', name: '弹簧', en: 'SPRING', count: '1 组', mat: '弹簧钢', color: '#d3dae4',
    desc: '蓄能复位元件：开伞末段助推锁定、收伞时提供回位力。实伞中多隐藏于中棒内部与下巢之中，此处示意其位置。' },
  { id: 'handle', name: '伞柄', en: 'HANDLE', count: '1 只', mat: 'ABS + 橡胶漆', color: '#2f3540',
    desc: '握持部件，内部容纳伸缩锁定机构与收拢弹簧，尾端常配腕带防脱手，底部即为整伞收纳时的底座。' },
  { id: 'finial', name: '伞顶珠（伞尖）', en: 'FINIAL', count: '1 只', mat: '电镀塑料', color: '#bfc7d1',
    desc: '中棒顶端的装饰防护帽，遮固上巢铰点与铆钉，防止顶端划伤伞布或人体。' },
  { id: 'beads', name: '骨尾珠（伞珠）', en: 'TIP CAP', count: '8 只', mat: 'PP 塑料', color: '#1c1f26',
    desc: '套在尾骨末端的小圆珠，顶住伞面角部的缝口，防止布面从骨架滑脱，也避免金属末端戳伤布料与人体。' },
];

/* ---------------- 工具 ---------------- */
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// 把单位高度圆柱放置在 a→b 之间
function setRod(mesh, ax, ay, az, bx, by, bz) {
  mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 1e-6;
  TMP_DIR.set(dx / len, dy / len, dz / len);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, TMP_DIR);
  mesh.scale.set(1, len, 1);
  return len;
}
const TMP_DIR = new THREE.Vector3();

/* ---------------- 场景 ---------------- */
const stage = document.getElementById('stage');
let renderer, labelRenderer, scene, camera, controls;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch (e) {
  stage.innerHTML = '<p style="padding:40px;color:#e8ecf5">当前环境不支持 WebGL，无法显示 3D 内容。</p>';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
document.getElementById('labelLayer').appendChild(labelRenderer.domElement);

scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.1, 500);
camera.position.set(45, 30, 57);

controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 23, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 12;
controls.maxDistance = 150;
controls.maxPolarAngle = 1.48;
controls.autoRotateSpeed = 1.1;

/* 环境光照（金属反射 / 暗面补光） */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

/* 灯光 */
scene.add(new THREE.HemisphereLight(0x9db4ff, 0x1a2033, 0.3));
const key = new THREE.DirectionalLight(0xfff4e0, 0.95);
key.position.set(18, 42, 14);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -50;
key.shadow.camera.right = key.shadow.camera.top = 50;
key.shadow.camera.far = 120;
key.shadow.bias = -0.0004;
scene.add(key);
const rim = new THREE.DirectionalLight(0x7fa8ff, 0.5);
rim.position.set(-22, 16, -18);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xffffff, 0.25);
fill.position.set(-12, 10, 20);
scene.add(fill);

/* 地面 */
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(36, 72),
  new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 0.96, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const ring = new THREE.Mesh(
  new THREE.RingGeometry(35.2, 36, 72),
  new THREE.MeshBasicMaterial({ color: 0x2a305c, transparent: true, opacity: 0.55 })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.01;
scene.add(ring);

/* 根节点：爆炸视图时整体抬升，避免零件沉入地面 */
const umbRoot = new THREE.Group();
scene.add(umbRoot);

/* ---------------- 部件注册 ---------------- */
const parts = {}; // id -> {def, meshes:[], mats:[], group, label}
for (const def of DEFS) {
  parts[def.id] = { def, meshes: [], mats: [], group: new THREE.Group(), label: null };
  umbRoot.add(parts[def.id].group);
}
const reg = (id, mesh) => {
  mesh.material = parts[id].mats[0]; // 套用部件材质（伞面在构建时单独指定）
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.partId = id;
  parts[id].meshes.push(mesh);
  parts[id].group.add(mesh);
  return mesh;
};
const matOf = (id) => parts[id].mats[0];

/* 材质 */
for (const def of DEFS) {
  if (def.id === 'canopy') continue; // 伞面单独建
  parts[def.id].mats.push(new THREE.MeshStandardMaterial({
    color: new THREE.Color(def.color),
    metalness: def.id === 'handle' || def.id === 'beads' ? 0.25 : 0.85,
    roughness: def.id === 'handle' ? 0.6 : 0.34,
    envMapIntensity: def.id === 'handle' || def.id === 'beads' ? 0.5 : 0.55,
  }));
}
const canopyMatA = new THREE.MeshPhysicalMaterial({
  color: 0x2b57c4, metalness: 0, roughness: 0.6, sheen: 0.5, sheenColor: 0x7fa0ff,
  side: THREE.DoubleSide, transparent: true, opacity: 1,
});
const canopyMatB = canopyMatA.clone();
canopyMatB.color = new THREE.Color(0x1d3f96);
canopyMatA.envMapIntensity = canopyMatB.envMapIntensity = 0.45;
parts.canopy.mats.push(canopyMatA, canopyMatB);

/* ---------------- 静态造型 ---------------- */
const unitCyl = (rT, rB, seg = 12) => new THREE.CylinderGeometry(rT, rB, 1, seg);

/* 伞面：8 片参数化网格，每帧随骨架重建顶点 */
const PANEL_U = 13, PANEL_V = 9;
const canopyPanels = [];
for (let i = 0; i < RIBS; i++) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(PANEL_U * PANEL_V * 3);
  const idx = [];
  for (let r = 0; r < PANEL_U - 1; r++) for (let c = 0; c < PANEL_V - 1; c++) {
    const a = r * PANEL_V + c;
    idx.push(a, a + PANEL_V, a + 1, a + 1, a + PANEL_V, a + PANEL_V + 1);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, i % 2 ? canopyMatB : canopyMatA);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.partId = 'canopy';
  parts.canopy.meshes.push(mesh);
  parts.canopy.group.add(mesh);
  canopyPanels.push(mesh);
}

/* 长骨 / 尾骨 / 骨关节 / 撑骨 / 骨尾珠 —— 每根伞骨一套 */
const ribRods = [], tipRods = [], jointPins = [], stretcherRods = [], stretcherHeads = [], beads = [];
for (let i = 0; i < RIBS; i++) {
  ribRods.push(reg('ribs', new THREE.Mesh(unitCyl(0.13, 0.165))));
  tipRods.push(reg('tips', new THREE.Mesh(unitCyl(0.115, 0.13))));
  jointPins.push(reg('joints', new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.85, 10))));
  stretcherRods.push(reg('stretchers', new THREE.Mesh(unitCyl(0.08, 0.08))));
  stretcherHeads.push(reg('stretchers', new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8))));
  beads.push(reg('beads', new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10))));
}

/* 下巢（滑套） */
{
  const collar = reg('runner', new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.5, 20)));
  collar.position.y = 0;
  const flangeTop = reg('runner', new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.8, 0.3, 20)));
  flangeTop.position.y = 0.62;
  const flangeBot = reg('runner', new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.84, 0.28, 20)));
  flangeBot.position.y = -0.6;
}

/* 上巢（伞顶盘） */
{
  const disc = reg('notch', new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.15, 24)));
  const cone = reg('notch', new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.3, 0.9, 16)));
}

/* 伞顶珠 */
{
  const stem = reg('finial', new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.9, 12)));
  const dome = reg('finial', new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 14)));
  dome.scale.y = 1.2;
}

/* 中棒三节 + 节顶箍环 */
const shaftRods = [], shaftCollars = [];
for (let s = 0; s < 3; s++) {
  shaftRods.push(reg('shaft', new THREE.Mesh(unitCyl(SEG[s][3], SEG[s][3], 18))));
  shaftCollars.push(reg('shaft', new THREE.Mesh(new THREE.CylinderGeometry(SEG[s][3] + 0.055, SEG[s][3] + 0.055, 0.7, 18))));
}

/* 伞柄 + 腕带 */
{
  const body = reg('handle', new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.22, 8.8, 22)));
  body.position.y = 5.0;
  const cap = reg('handle', new THREE.Mesh(new THREE.SphereGeometry(1.24, 20, 14)));
  cap.scale.set(1, 0.55, 1);
  cap.position.y = 0.65;
  const collar = reg('handle', new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.42, 0.9, 22)));
  collar.position.y = 9.85;
  const strap = reg('handle', new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.075, 8, 40, Math.PI * 1.35)));
  strap.position.set(1.05, 1.7, 0.85);
  strap.rotation.set(0.25, 0.6, 0.35);
}

/* 弹簧（随下巢滑动） */
let springMesh;
{
  const pts = [];
  const turns = 7, H = 3.6;
  for (let k = 0; k <= 160; k++) {
    const f = k / 160;
    pts.push(new THREE.Vector3(Math.cos(f * turns * Math.PI * 2) * 0.5, f * H, Math.sin(f * turns * Math.PI * 2) * 0.5));
  }
  springMesh = reg('spring', new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.068, 8)));
}

/* ---------------- 运动学状态 ---------------- */
const K = {
  t: 0, e: 0,
  Htop: TOP_CLOSED, ry: 12,
  theta: TH_CLOSED, thetaTip: FOLD_CLOSED + TH_CLOSED,
  pivot: new THREE.Vector3(),
  ribs: [], // 每根: {H, J, T, C} (Vector3, 世界系, 未加爆炸偏移)
};
for (let i = 0; i < RIBS; i++) {
  K.ribs.push({ H: new THREE.Vector3(), J: new THREE.Vector3(), T: new THREE.Vector3(), C: new THREE.Vector3(), dir: new THREE.Vector3() });
}

function ribDir(i) {
  const phi = (i / RIBS) * Math.PI * 2;
  return K.ribs[i].H.set(Math.sin(phi), 0, Math.cos(phi));
}

function updateKinematics(t, e) {
  const s = easeIO(clamp01(t));
  K.t = t; K.e = e;
  K.theta = lerp(TH_CLOSED, TH_OPEN, s);
  K.thetaTip = K.theta + lerp(FOLD_CLOSED, FOLD_OPEN, s);
  K.Htop = lerp(TOP_CLOSED, TOP_OPEN, s);
  K.pivot.set(0, K.Htop, 0);

  const st = Math.sin(K.theta), ct = Math.cos(K.theta);
  const stT = Math.sin(K.thetaTip), ctT = Math.cos(K.thetaTip);
  for (let i = 0; i < RIBS; i++) {
    const R = K.ribs[i];
    ribDir(i);
    const H = R.H, P = K.pivot;
    // 长骨: 上巢铰点 → 骨关节
    R.J.set(P.x + (PIVOT_R + A_IN * st) * H.x, P.y - A_IN * ct, P.z + (PIVOT_R + A_IN * st) * H.z);
    // 尾骨: 骨关节 → 骨尾珠
    R.T.set(R.J.x + B_TIP * stT * H.x, R.J.y - B_TIP * ctT, R.J.z + B_TIP * stT * H.z);
    // 撑骨上铰点
    R.C.set(P.x + (PIVOT_R + C_ATT * st) * H.x, P.y - C_ATT * ct, P.z + (PIVOT_R + C_ATT * st) * H.z);
  }
  // 下巢高度: 解撑骨长度约束
  const dx = PIVOT_R + C_ATT * st - 0.5;
  K.ry = (K.pivot.y - C_ATT * ct) - Math.sqrt(Math.max(S_STR * S_STR - dx * dx, 0.01));

  /* --- 摆放骨架零件（含爆炸偏移） --- */
  const P = K.pivot;
  for (let i = 0; i < RIBS; i++) {
    const R = K.ribs[i], H = R.H;
    const offRib = 10 * e, offTip = 18 * e, offStr = 6 * e;
    const px = H.x, pz = H.z;
    // 长骨
    setRod(ribRods[i],
      P.x + PIVOT_R * px + px * offRib, P.y + offRib, P.z + PIVOT_R * pz + pz * offRib,
      R.J.x + px * offRib, R.J.y + offRib, R.J.z + pz * offRib);
    // 尾骨
    setRod(tipRods[i],
      R.J.x + px * offTip, R.J.y + offTip, R.J.z + pz * offTip,
      R.T.x + px * offTip, R.T.y + offTip, R.T.z + pz * offTip);
    // 骨关节（转轴垂直于骨面）
    jointPins[i].position.set(R.J.x + px * offRib, R.J.y + offRib, R.J.z + pz * offRib);
    TMP_DIR.set(H.z, 0, -H.x).multiplyScalar(-1);
    jointPins[i].quaternion.setFromUnitVectors(Y_AXIS, TMP_DIR);
    // 骨尾珠
    beads[i].position.set(R.T.x + px * offTip, R.T.y + offTip, R.T.z + pz * offTip);
    // 撑骨 + 上端铆珠
    setRod(stretcherRods[i],
      px * (0.5 + offStr), K.ry + 0.1, pz * (0.5 + offStr),
      R.C.x + px * offStr, R.C.y, R.C.z + pz * offStr);
    stretcherHeads[i].position.set(R.C.x + px * offStr, R.C.y, R.C.z + pz * offStr);
  }

  /* 下巢 / 弹簧 */
  parts.runner.group.position.y = K.ry - 8 * e;
  springMesh.position.y = K.ry + 0.9 - 8 * e;

  /* 上巢 / 伞顶珠 */
  parts.notch.group.position.set(0, K.Htop + 10 * e, 0);
  parts.finial.group.position.set(0, K.Htop + 18 * e, 0);
  const nd = parts.notch.group.children;
  // 上巢盘与锥座（子级局部坐标）
  nd[0].position.set(0, -0.35, 0);
  nd[1].position.set(0, -1.35, 0);
  const fd = parts.finial.group.children;
  fd[0].position.set(0, 0.55, 0);
  fd[1].position.set(0, 1.35, 0);

  /* 中棒三节（伸缩） */
  for (let si = 0; si < 3; si++) {
    const [bC, bO, len] = SEG[si];
    const bottom = lerp(bC, bO, s);
    const dy = [-4, 2, 8][si] * e;
    shaftRods[si].position.set(0, bottom + len / 2 + dy, 0);
    shaftRods[si].scale.set(1, len, 1);
    shaftCollars[si].position.set(0, bottom + len - 0.35 + dy, 0);
  }

  /* 伞柄（爆炸下移）+ 整体抬升 */
  parts.handle.group.position.y = -14 * e;
  umbRoot.position.y = 14 * e;

  /* 伞面重建 */
  rebuildCanopy();
}

/* 伞面顶点：沿两根相邻伞骨的折线插值 + 面间垂坠 */
const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _p = new THREE.Vector3();
function fabricEdge(i, u, out) {
  const R = K.ribs[i], H = R.H;
  // 布面固结点略位于骨轴外侧
  const ax = PIVOT_R * H.x + 0.18 * H.x, az = PIVOT_R * H.z + 0.18 * H.z;
  const A0x = ax, A0y = K.pivot.y + 0.1, A0z = az;
  const A1x = R.J.x + 0.18 * H.x, A1y = R.J.y, A1z = R.J.z + 0.18 * H.z;
  const A2x = R.T.x + 0.18 * H.x, A2y = R.T.y, A2z = R.T.z + 0.18 * H.z;
  if (u < 0.5) { const f = u * 2; out.set(lerp(A0x, A1x, f), lerp(A0y, A1y, f), lerp(A0z, A1z, f)); }
  else { const f = u * 2 - 1; out.set(lerp(A1x, A2x, f), lerp(A1y, A2y, f), lerp(A1z, A2z, f)); }
}
function rebuildCanopy() {
  const lift = 18 * K.e;
  for (let i = 0; i < RIBS; i++) {
    const geo = canopyPanels[i].geometry;
    const pos = geo.attributes.position;
    const j = (i + 1) % RIBS;
    for (let r = 0; r < PANEL_U; r++) {
      const u = r / (PANEL_U - 1);
      fabricEdge(i, u, _e1);
      fabricEdge(j, u, _e2);
      for (let c = 0; c < PANEL_V; c++) {
        const v = c / (PANEL_V - 1);
        _p.lerpVectors(_e1, _e2, v);
        const sag = Math.sin(v * Math.PI);
        const f = 1 - (0.028 + 0.05 * smooth(0.45, 1, u)) * sag;
        _p.x *= f; _p.z *= f;
        _p.y += lift - 0.5 * sag * Math.pow(u, 1.6);
        pos.setXYZ(r * PANEL_V + c, _p.x, _p.y, _p.z);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
}

/* ---------------- 标签 ---------------- */
const labelDefs = [
  ['canopy', () => { const R = K.ribs[1]; return new THREE.Vector3(R.T.x * 0.92, R.T.y + 1.4, R.T.z * 0.92); }],
  ['ribs', () => { const R = K.ribs[0], s = Math.sin(K.theta); return new THREE.Vector3(R.H.x * (PIVOT_R + A_IN * 0.62 * s), K.pivot.y - A_IN * 0.62 * Math.cos(K.theta), R.H.z * (PIVOT_R + A_IN * 0.62 * s)); }],
  ['tips', () => { const R = K.ribs[5], s = Math.sin(K.thetaTip); return new THREE.Vector3(R.J.x + B_TIP * 0.6 * s * R.H.x, R.J.y - B_TIP * 0.6 * Math.cos(K.thetaTip), R.J.z + B_TIP * 0.6 * s * R.H.z); }],
  ['joints', () => { const R = K.ribs[3]; return new THREE.Vector3(R.J.x * 1.06, R.J.y - 0.5, R.J.z * 1.06); }],
  ['stretchers', () => { const R = K.ribs[2]; return new THREE.Vector3((0.5 + R.C.x) / 2 + 0.6, (K.ry + R.C.y) / 2, (0.5 * R.H.z + R.C.z) / 2); }],
  ['runner', () => new THREE.Vector3(-2.1, K.ry + 0.2, 0)],
  ['notch', () => new THREE.Vector3(2.0, K.Htop - 0.4, 0)],
  ['shaft', () => new THREE.Vector3(1.5, 15.5, 0)],
  ['spring', () => new THREE.Vector3(1.4, K.ry + 2.6, 0)],
  ['handle', () => new THREE.Vector3(2.1, 5.6, 0)],
  ['finial', () => new THREE.Vector3(0, K.Htop + 2.9, 0)],
  ['beads', () => { const R = K.ribs[6]; return new THREE.Vector3(R.T.x + R.H.x * 0.7, R.T.y - 0.4, R.T.z + R.H.z * 0.7); }],
];
for (const [id, getPos] of labelDefs) {
  const el = document.createElement('div');
  el.className = 'part-label';
  el.innerHTML = `<i class="dot"></i><span>${parts[id].def.name}</span>`;
  el.addEventListener('click', (ev) => { ev.stopPropagation(); selectPart(id); });
  const obj = new CSS2DObject(el);
  obj.visible = false; // 默认隐藏，由“标签”开关控制
  parts[id].label = { obj, el, getPos };
  umbRoot.add(obj);
}
let labelsOn = false;
function setLabels(on) {
  labelsOn = on;
  for (const id in parts) parts[id].label.obj.visible = on;
  document.getElementById('btnLabels').classList.toggle('on', on);
}
function updateLabelPositions() {
  if (!labelsOn) return;
  for (const id in parts) {
    const L = parts[id].label;
    L.obj.position.copy(L.getPos());
  }
}

/* ---------------- 高亮 / 选择 ---------------- */
const HL = new THREE.Color(0xffb020);
let hoverId = null, selectedId = null, isolate = false;

function setEmissive(id, k) {
  for (const m of parts[id].mats) {
    m.emissive.copy(HL);
    m.emissiveIntensity = k;
  }
}
function refreshHighlight() {
  for (const def of DEFS) {
    // 伞面面积大，用更弱的自发光避免整片变色
    const hl = def.id === 'canopy' ? 0.15 : 0.55;
    const k = def.id === selectedId ? hl : (def.id === hoverId ? hl * 0.55 : 0);
    setEmissive(def.id, k);
  }
  for (const def of DEFS) {
    parts[def.id].label?.el.classList.toggle('active', def.id === hoverId || def.id === selectedId);
  }
}
function applyVisibility() {
  for (const def of DEFS) {
    const vis = !isolate || def.id === selectedId;
    parts[def.id].group.visible = vis;
    parts[def.id].label.obj.visible = vis && labelsOn;
  }
}

function selectPart(id) {
  selectedId = id;
  if (!id) {
    isolate = false;
    document.getElementById('detailCard').classList.add('hidden');
  } else {
    renderDetail();
  }
  refreshHighlight();
  applyVisibility();
  renderList();
}
function renderDetail() {
  const d = parts[selectedId].def;
  const card = document.getElementById('detailCard');
  card.classList.remove('hidden');
  card.innerHTML = `
    <h3>${d.name}<span class="en">${d.en}</span></h3>
    <div class="meta"><span>${d.count}</span><span>${d.mat}</span></div>
    <p>${d.desc}</p>
    <div class="acts">
      <button id="btnIso" class="${isolate ? 'on' : ''}">${isolate ? '✓ 仅显示此件' : '隔离显示'}</button>
      <button id="btnClose">关闭</button>
    </div>`;
  card.querySelector('#btnIso').onclick = () => {
    isolate = !isolate;
    renderDetail(); applyVisibility();
  };
  card.querySelector('#btnClose').onclick = () => selectPart(null);
}
function renderList() {
  const ul = document.getElementById('partList');
  ul.innerHTML = '';
  for (const def of DEFS) {
    const li = document.createElement('li');
    li.className = 'part-item' + (def.id === selectedId ? ' active' : '');
    li.innerHTML = `<span class="swatch" style="background:${def.color}"></span><span class="nm">${def.name}</span><span class="ct">${def.count}</span>`;
    li.onmouseenter = () => { hoverId = def.id; refreshHighlight(); };
    li.onmouseleave = () => { hoverId = null; refreshHighlight(); };
    li.onclick = () => { selectPart(def.id); focusPart(def.id); };
    ul.appendChild(li);
  }
}
document.getElementById('partStat').textContent =
  `${DEFS.length} 类 · ${DEFS.reduce((n, d) => n + (parseInt(d.count) || 1), 0)} 件`;
renderList();

/* ---------------- 拾取 ---------------- */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pickAt(clientX, clientY) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const targets = [];
  for (const def of DEFS) if (parts[def.id].group.visible) targets.push(...parts[def.id].meshes);
  const hits = raycaster.intersectObjects(targets, false);
  return hits.length ? hits[0].object.userData.partId : null;
}
let downX = 0, downY = 0, downT = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; downT = performance.now(); camAnim = null; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6 || performance.now() - downT > 450) return;
  const id = pickAt(e.clientX, e.clientY);
  selectPart(id);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.buttons) return;
  const id = pickAt(e.clientX, e.clientY);
  if (id !== hoverId) {
    hoverId = id;
    renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
    refreshHighlight();
  }
});
renderer.domElement.style.cursor = 'grab';

/* ---------------- UI 控制 ---------------- */
const slider = document.getElementById('openSlider');
const stateTag = document.getElementById('stateTag');
let playMode = 'off'; // off | intro | loop
let playDir = 1, playT = 0;

function setT(t, fromSlider = false) {
  updateKinematics(clamp01(t), K.e);
  if (!fromSlider) slider.value = Math.round(K.t * 1000);
  stateTag.textContent = K.t <= 0.005 ? '收合' : K.t >= 0.995 ? '展开' : `开合中 ${Math.round(K.t * 100)}%`;
}
function setPlay(mode) {
  playMode = mode;
  const b = document.getElementById('btnPlay');
  b.textContent = mode === 'off' ? '▶ 开合演示' : '⏸ 暂停';
  b.classList.toggle('on', mode !== 'off');
}
slider.addEventListener('input', () => { setPlay('off'); setT(slider.value / 1000, true); });
document.getElementById('btnPlay').onclick = () => setPlay(playMode === 'off' ? 'loop' : 'off');
document.getElementById('btnReset').onclick = resetView;
document.getElementById('btnSpin').onclick = function () {
  controls.autoRotate = !controls.autoRotate;
  this.classList.toggle('on', controls.autoRotate);
};
document.getElementById('btnLabels').onclick = () => setLabels(!labelsOn);
document.getElementById('panelToggle').onclick = () => {
  document.getElementById('sidePanel').classList.toggle('collapsed');
};
if (innerWidth < 640) document.getElementById('sidePanel').classList.add('collapsed');

/* 透视伞面 */
let xray = false;
document.getElementById('btnXray').onclick = function () {
  xray = !xray;
  this.classList.toggle('on', xray);
};

/* 爆炸视图（自动拉远取景） */
let explodeOn = false;
document.getElementById('btnExplode').onclick = function () {
  explodeOn = !explodeOn;
  this.classList.toggle('on', explodeOn);
  camAnim = {
    t0: performance.now(), dur: 800,
    c0: camera.position.clone(),
    c1: explodeOn ? new THREE.Vector3(63, 52, 81) : new THREE.Vector3(45, 30, 57),
    g0: controls.target.clone(),
    g1: explodeOn ? new THREE.Vector3(0, 38, 0) : new THREE.Vector3(0, 23, 0),
  };
};

/* 相机聚焦动画 */
let camAnim = null;
function resetView() {
  camAnim = {
    t0: performance.now(), dur: 650,
    c0: camera.position.clone(), c1: new THREE.Vector3(45, 30, 57),
    g0: controls.target.clone(), g1: new THREE.Vector3(0, 23, 0),
  };
}
function focusPart(id) {
  const box = new THREE.Box3().setFromObject(parts[id].group);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 3);
  const dir = camera.position.clone().sub(controls.target).normalize();
  camAnim = {
    t0: performance.now(), dur: 700,
    c0: camera.position.clone(), c1: c.clone().add(dir.multiplyScalar(Math.max(r * 3.2, 13))),
    g0: controls.target.clone(), g1: c.clone(),
  };
}

/* ---------------- 主循环 ---------------- */
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (playMode !== 'off') {
    playT += dt / (playMode === 'intro' ? 3.2 : 3.4) * playDir;
    if (playT >= 1) {
      if (playMode === 'intro') { playT = 1; setPlay('off'); }
      else { playT = 1; playDir = -1; }
    } else if (playT <= 0) { playT = 0; playDir = 1; }
    setT(playT);
  }

  // 爆炸系数缓动
  const eTarget = explodeOn ? 1 : 0;
  if (Math.abs(K.e - eTarget) > 0.001) {
    K.e = lerp(K.e, eTarget, Math.min(1, dt * 4.5));
    updateKinematics(K.t, K.e);
  }

  // 透视伞面
  for (const m of parts.canopy.mats) {
    const target = xray ? 0.16 : 1;
    if (Math.abs(m.opacity - target) > 0.002) {
      m.opacity = lerp(m.opacity, target, Math.min(1, dt * 6));
      const solid = m.opacity > 0.55;
      m.depthWrite = solid;
      canopyPanels.forEach(p => p.castShadow = solid);
    }
  }

  // 相机动画
  if (camAnim) {
    const f = easeIO(clamp01((performance.now() - camAnim.t0) / camAnim.dur));
    camera.position.lerpVectors(camAnim.c0, camAnim.c1, f);
    controls.target.lerpVectors(camAnim.g0, camAnim.g1, f);
    if (f >= 1) camAnim = null;
  }

  controls.update();
  updateLabelPositions();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') selectPart(null); });

/* 启动：收合状态 → 自动开伞一次 */
updateKinematics(0, 0);
setT(0);
tick();
setTimeout(() => { playT = 0; playDir = 1; setPlay('intro'); }, 600);

// 调试钩子（控制台可用）
window.__umb = { scene, parts, K, camera, controls };
