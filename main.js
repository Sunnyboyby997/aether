
import * as THREE from 'three';

/* ============================================================
   AETHER — WebGL particle field
   A Lusion-style cinematic background: a flowing particle mass
   driven by simplex noise, camera dives through on scroll,
   palette shifts per section.
   ============================================================ */

const canvas = document.getElementById('webgl');
const isMobile = window.innerWidth < 768;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 9);

/* ---------- particles ---------- */
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

const uniforms = {
  uTime: { value: 0 },
  uPixelRatio: { value: renderer.getPixelRatio() },
  uColorA: { value: new THREE.Color('#2b2bff') },
  uColorB: { value: new THREE.Color('#7ee8ff') },
  uColorC: { value: new THREE.Color('#ffb27a') },
  uMix: { value: 0 },
};

const VERT = /* glsl */`
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  attribute float aSize;
  varying float vSeed;
  varying float vAlpha;

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

  void main(){
    vec3 pos = position;
    float t = uTime * 0.16;

    float n1 = snoise(vec3(pos.x * 0.30, pos.y * 0.30, t));
    float n2 = snoise(vec3(pos.x * 0.30 + 4.7, pos.y * 0.30 - 2.1, t * 0.72));
    float flow = n1 * 0.72 + n2 * 0.28;

    pos.x += flow * 0.65;
    pos.y += snoise(vec3(pos.y * 0.30, pos.z * 0.30, t * 1.1)) * 0.55;
    pos.z += snoise(vec3(pos.z * 0.30, pos.x * 0.30, t * 0.85)) * 0.55;

    pos += pos * 0.03 * sin(t * 1.4 + aSeed * 6.28318);

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

/* ---------- interaction state ---------- */
let scroll = 0, targetScroll = 0;
let mpx = window.innerWidth / 2, mpy = window.innerHeight / 2;
let tmpx = window.innerWidth / 2, tmpy = window.innerHeight / 2;
let mx = 0, my = 0;

function smoothstep(a, b, x) {
  x = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

window.addEventListener('scroll', () => {
  const max = document.body.scrollHeight - window.innerHeight;
  targetScroll = max > 0 ? window.scrollY / max : 0;
}, { passive: true });

window.addEventListener('mousemove', (e) => {
  tmpx = e.clientX; tmpy = e.clientY;
  glow.style.opacity = '1';
}, { passive: true });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  uniforms.uPixelRatio.value = renderer.getPixelRatio();
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

  uniforms.uTime.value = t;
  uniforms.uMix.value = smoothstep(0.34, 0.78, scroll);

  if (glow) glow.style.transform = `translate(${mpx}px, ${mpy}px) translate(-50%, -50%)`;
  if (bar) bar.style.transform = `scaleX(${scroll})`;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
