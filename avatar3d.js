import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

// Swap the model by replacing public/models/assistant.glb and editing these clip names.
const MODEL_URL = "./models/assistant.glb";
const CLIPS = {
  normal: { clip: "Idle", speed: 1, tilt: 0 },
  tired: { clip: "Idle", speed: 0.55, tilt: -0.06 },
  injured: { clip: "Sitting", speed: 0.7, tilt: -0.12 },
};
const GREETING_CLIP = "Wave";

const THEMES = {
  warrior: { glow: 0x735cff },
  ranger: { glow: 0x62e6ff },
  mage: { glow: 0xc9a2ff },
  allrounder: { glow: 0xff5db1 },
};

let modelPromise;
let greeted = false;

// The dashboard re-renders via innerHTML, so the GLB is fetched and parsed only once.
function loadModel() {
  modelPromise ??= new GLTFLoader().loadAsync(MODEL_URL).catch((error) => {
    modelPromise = undefined;
    throw error;
  });
  return modelPromise;
}

function fitToView(model) {
  model.updateMatrixWorld(true); // a fresh SkeletonUtils clone has stale world matrices
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = 1.9 / Math.max(size.y, 0.001);
  model.scale.setScalar(scale);
  const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
  model.position.set(-center.x, -box.min.y * scale - 0.55, -center.z);
}

export async function mountAvatar(container, { className = "warrior", avatarState = "normal" } = {}) {
  let gltf;
  try {
    gltf = await loadModel();
  } catch (error) {
    console.warn("3D assistant unavailable, keeping 2D fallback", error);
    return;
  }
  if (!container.isConnected) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch (error) {
    console.warn("WebGL unavailable, keeping 2D fallback", error);
    return;
  }

  const glow = (THEMES[className] || THEMES.warrior).glow;
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
  camera.position.set(0, 0.5, 4.4);
  camera.lookAt(0, 0.45, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "3D assistant guide");

  scene.add(new THREE.HemisphereLight(0xd8f4ff, 0x111b2a, 2.3));
  const key = new THREE.DirectionalLight(0xffe5c5, 3.4);
  key.position.set(3, 4, 4);
  scene.add(key);
  const rim = new THREE.PointLight(glow, 2.4, 8);
  rim.position.set(-2, 1.7, 2);
  scene.add(rim);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.018, 8, 52),
    new THREE.MeshStandardMaterial({ color: glow, roughness: 0.25, metalness: 0.65 }),
  );
  ring.position.y = -0.55;
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  const assistant = cloneSkinned(gltf.scene);
  fitToView(assistant);
  const pose = CLIPS[avatarState] || CLIPS.normal;
  const holder = new THREE.Group();
  holder.rotation.z = pose.tilt;
  holder.add(assistant);
  scene.add(holder);

  const mixer = new THREE.AnimationMixer(assistant);
  const findClip = (name) => THREE.AnimationClip.findByName(gltf.animations, name);
  const loopClip = findClip(pose.clip) || findClip(CLIPS.normal.clip) || gltf.animations[0];
  const loopAction = loopClip ? mixer.clipAction(loopClip).setEffectiveTimeScale(pose.speed).play() : null;
  const greetClip = findClip(GREETING_CLIP);
  // Wave once per app session, then settle back into the state's loop.
  if (!greeted && avatarState === "normal" && greetClip && loopAction) {
    greeted = true;
    const greet = mixer.clipAction(greetClip).setLoop(THREE.LoopOnce, 1);
    greet.clampWhenFinished = true;
    loopAction.stop();
    greet.play();
    mixer.addEventListener("finished", () => {
      greet.fadeOut(0.4);
      loopAction.reset().fadeIn(0.4).play();
    });
  }

  container.replaceChildren(renderer.domElement);

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const clock = new THREE.Clock();
  let frame;
  const resize = () => {
    if (!container.isConnected) return;
    const nextWidth = Math.max(1, container.clientWidth);
    const nextHeight = Math.max(1, container.clientHeight);
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight, false);
    if (reduceMotion) renderer.render(scene, camera);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  const dispose = () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    mixer.stopAllAction();
    mixer.uncacheRoot(assistant);
    ring.geometry.dispose();
    ring.material.dispose();
    renderer.dispose();
  };

  if (reduceMotion) {
    mixer.update(0);
    renderer.render(scene, camera);
    // Nothing animates, so check rarely just to release GPU resources after a re-render.
    const watcher = setInterval(() => {
      if (container.isConnected) return;
      clearInterval(watcher);
      dispose();
    }, 2000);
    return;
  }

  const animate = () => {
    if (!container.isConnected) return dispose();
    mixer.update(clock.getDelta());
    holder.rotation.y = Math.sin(clock.elapsedTime * 0.65) * 0.18;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  };
  animate();
}
