
import * as THREE from 'three';

/* ============================================================
   ZOUWENSHENG — WebGL particle field + cursor swarm
   A flowing particle mass (simplex noise) that parts around the
   cursor, plus an orbiting particle swarm that follows the mouse.
   ============================================================ */

const canvas = document.getElementById('webgl');
const isMobile = window.innerWidth < 768;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 9);

/* ---------- simplex noise 3D (shared GLSL) ---------- */
const NOISE = `
  vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

/* ---------- main particle field ---------- */
const COUNT = isMobile ? 30000 : 60000;
const positions = new Float32Array(COUNT * 3);
const seeds = new Float32Array(COUNT);
const sizes = new Float32Array(COUNT);

for (let i = 0; i < COUNT; i++) {
  positions[i * 3 + 0] = (Math.random() - 0.5) * 20;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 11;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 13;
  seeds[i] = Math.random();
  sizes[i] = Math.random() * 2.2 + 0.6;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

const mouseLocal = new THREE.Vector3(0, 9999, 0);

const uniforms = {
  uTime: { value: 0 },
  uPixelRatio: { value: renderer.getPixelRatio() },
  uColorA: { value: new THREE.Color('#2b2bff') },
  uColorB: { value: new THREE.Color('#7ee8ff') },
  uColorC: { value: new THREE.Color('#ffb27a') },
  uMix: { value: 0 },
  uMouse: { value: mouseLocal },
};

const VERT = NOISE + /* glsl */`
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3 uMouse;
  attribute float aSeed;
  attribute float aSize;
  varying float vSeed;
  varying float vAlpha;

  void main(){
    vec3 pos = position;
    float t = uTime * 0.22;

    float n1 = snoise(vec3(pos.x * 0.30, pos.y * 0.30, t));
    float n2 = snoise(vec3(pos.x * 0.30 + 4.7, pos.y * 0.30 - 2.1, t * 0.72));
    float flow = n1 * 0.72 + n2 * 0.28;

    pos.x += flow * 0.9;
    pos.y += snoise(vec3(pos.y * 0.30, pos.z * 0.30, t * 1.1)) * 0.75;
    pos.z += snoise(vec3(pos.z * 0.30, pos.x * 0.30, t * 0.85)) * 0.75;

    pos += pos * 0.035 * sin(t * 1.4 + aSeed * 6.28318);

    // mouse repel — parts the field around the cursor
    vec2 diff = pos.xy - uMouse.xy;
    float dist = length(diff) + 0.001;
    float strength = smoothstep(2.2, 0.0, dist);
    pos.xy += (diff / dist) * strength * 1.5;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * 2.6 * (1.0 / -mv.z);

    float depthFade = clamp(1.0 / (1.0 + length(pos) * 0.10), 0.12, 1.0);
    vAlpha = depthFade * (0.35 + 0.65 * smoothstep(-1.0, 1.0, n1));
    vSeed = aSeed;
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uMix;
  varying float vSeed;
  varying float vAlpha;

  void main(){
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float circle = smoothstep(0.5, 0.0, d);
    float alpha = pow(circle, 2.4);

    vec3 colAB = mix(uColorA, uColorB, vSeed);
    vec3 col = mix(colAB, uColorC, uMix * smoothstep(0.0, 1.0, vSeed));

    gl_FragColor = vec4(col, alpha * vAlpha * 0.6);
  }
`;

const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: VERT,
  fragmentShader: FRAG,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const points = new THREE.Points(geometry, material);
scene.add(points);

/* ---------- cursor swarm (orbiting particles follow mouse) ---------- */
const SWARM_COUNT = 260;
const sAngles = new Float32Array(SWARM_COUNT);
const sRadii = new Float32Array(SWARM_COUNT);
const sSpeeds = new Float32Array(SWARM_COUNT);
const sSizes = new Float32Array(SWARM_COUNT);

for (let i = 0; i < SWARM_COUNT; i++) {
  sAngles[i] = Math.random() * Math.PI * 2;
  sRadii[i] = 0.05 + Math.random() * 0.45;
  sSpeeds[i] = 0.4 + Math.random() * 0.8;
  sSizes[i] = 0.7 + Math.random() * 1.2;
}

const swarmGeo = new THREE.BufferGeometry();
swarmGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SWARM_COUNT * 3), 3));
swarmGeo.setAttribute('aAngle', new THREE.BufferAttribute(sAngles, 1));
swarmGeo.setAttribute('aRadius', new THREE.BufferAttribute(sRadii, 1));
swarmGeo.setAttribute('aSpeed', new THREE.BufferAttribute(sSpeeds, 1));
swarmGeo.setAttribute('aSize', new THREE.BufferAttribute(sSizes, 1));

const swarmUniforms = {
  uTime: { value: 0 },
  uPixelRatio: { value: renderer.getPixelRatio() },
  uMouse: { value: new THREE.Vector3(0, 9999, 0) },
  uColor: { value: new THREE.Color('#a8f0ff') },
};

const SWARM_VERT = /* glsl */`
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3 uMouse;
  attribute float aAngle;
  attribute float aRadius;
  attribute float aSpeed;
  attribute float aSize;
  varying float vAlpha;

  void main(){
    float ang = aAngle + uTime * aSpeed;
    float r = aRadius * (1.0 + 0.15 * sin(uTime * 0.9 + aAngle));
    vec3 pos = uMouse + vec3(cos(ang), sin(ang), 0.0) * r;
    pos.z += sin(uTime * 0.7 + aAngle) * 0.3;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * 2.4 * (1.0 / -mv.z);
    vAlpha = 0.75 * (0.5 + 0.5 * sin(uTime * 2.2 + aAngle));
  }
`;

const SWARM_FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uColor;
  varying float vAlpha;

  void main(){
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = pow(smoothstep(0.5, 0.0, d), 2.0);
    gl_FragColor = vec4(uColor, a * vAlpha);
  }
`;

const swarm = new THREE.Points(swarmGeo, new THREE.ShaderMaterial({
  uniforms: swarmUniforms,
  vertexShader: SWARM_VERT,
  fragmentShader: SWARM_FRAG,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
}));
swarm.visible = false;
scene.add(swarm);

/* ---------- interaction state ---------- */
let scroll = 0, targetScroll = 0;
let mpx = window.innerWidth / 2, mpy = window.innerHeight / 2;
let tmpx = window.innerWidth / 2, tmpy = window.innerHeight / 2;
let mx = 0, my = 0;

function smoothstep(a, b, x) {
  x = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const mouseWorld = new THREE.Vector3(0, 9999, 0);

window.addEventListener('scroll', () => {
  const max = document.body.scrollHeight - window.innerHeight;
  targetScroll = max > 0 ? window.scrollY / max : 0;
}, { passive: true });

window.addEventListener('mousemove', (e) => {
  tmpx = e.clientX; tmpy = e.clientY;
  swarm.visible = true;
  glow.style.opacity = '1';
}, { passive: true });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  uniforms.uPixelRatio.value = renderer.getPixelRatio();
  swarmUniforms.uPixelRatio.value = renderer.getPixelRatio();
});

/* ---------- text reveals ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('in-view');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.18 });

document.querySelectorAll('.reveal').forEach((el) => {
  el.style.transitionDelay = (el.dataset.delay ? parseFloat(el.dataset.delay) : 0) + 'ms';
  io.observe(el);
});

/* ---------- dom refs ---------- */
const glow = document.querySelector('.cursor-glow');
const bar = document.querySelector('.progress-bar');

/* ---------- render loop ---------- */
const clock = new THREE.Clock();

function animate() {
  const t = clock.elapsedTime;

  scroll += (targetScroll - scroll) * 0.07;
  mpx += (tmpx - mpx) * 0.06;
  mpy += (tmpy - mpy) * 0.06;
  mx = (mpx / window.innerWidth - 0.5) * 2;
  my = (mpy / window.innerHeight - 0.5) * 2;

  points.rotation.y = scroll * 2.6 + t * 0.015;
  points.rotation.x = my * 0.10;

  camera.position.x = mx * 0.55;
  camera.position.y = -my * 0.35;
  camera.position.z = 9 - scroll * 4.0;
  camera.lookAt(0, 0, 0);

  // world-space mouse → field-local (for repel) and swarm (world)
  ndc.set(mx, my);
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(plane, mouseWorld);

  mouseLocal.copy(mouseWorld);
  points.worldToLocal(mouseLocal);

  swarmUniforms.uMouse.value.copy(mouseWorld);

  uniforms.uTime.value = t;
  swarmUniforms.uTime.value = t;
  uniforms.uMix.value = smoothstep(0.34, 0.78, scroll);

  if (glow) glow.style.transform = `translate(${mpx}px, ${mpy}px) translate(-50%, -50%)`;
  if (bar) bar.style.transform = `scaleX(${scroll})`;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
