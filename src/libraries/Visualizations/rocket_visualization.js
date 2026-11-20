import * as THREE from "three";
import { GLTFLoader } from "GLTFLoader";

async function mountRocketScene() {
  const mount = document.querySelector("#rocket");
  if (!mount) {
    console.error("No #rocket element found to mount Three.js scene.");
    return;
  }

  mount.innerHTML = "";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("skyblue");

  // Add Fog to hide the "edge" of the infinite plane in the distance
  scene.fog = new THREE.Fog(0x87ceeb, 2000, 10000);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  const getSize = () => {
    const { clientWidth, clientHeight } = mount;
    return {
      width: Math.max(1, clientWidth),
      height: Math.max(1, clientHeight),
    };
  };

  const { width, height } = getSize();

  // Increased Far Plane to 20,000 to see the horizon
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 20000);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  mount.appendChild(renderer.domElement);

  // --- INFINITE GROUND SETUP ---
  const textureLoader = new THREE.TextureLoader();
  const groundUrl = new URL("./Repeating_Farmlands.png", import.meta.url).href;
  const groundTexture = textureLoader.load(groundUrl);

  groundTexture.wrapS = THREE.RepeatWrapping;
  groundTexture.wrapT = THREE.RepeatWrapping;

  const textureRepeatScale = 5;
  groundTexture.repeat.set(textureRepeatScale, textureRepeatScale);
  groundTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const groundGeo = new THREE.PlaneGeometry(20000, 20000);
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 1, metalness: 0, color: 0xbbbbbb });
  const infiniteGround = new THREE.Mesh(groundGeo, groundMat);

  infiniteGround.rotation.x = -Math.PI / 2;
  infiniteGround.position.y = -2.1;
  scene.add(infiniteGround);
  // ------------------------------

  // Original Farm Loader
  const farmLoader = new GLTFLoader();
  const farmUrl = new URL("./farm_3d+2d.glb", import.meta.url).href;

  farmLoader.load(
    farmUrl,
    (gltf) => {
      const farm = gltf.scene;
      scene.add(farm);
      farm.position.set(-250, 5, 0);
      farm.traverse((child) => {
        if (child.isMesh) child.frustumCulled = false;
      });
    },
    undefined,
    (error) => console.error("Error loading farm:", error)
  );

  const targetPosition = new THREE.Vector3(0, 0, 0);
  const targetRotation = new THREE.Euler(0, 0, 0, "XYZ");

  let rocketModel = null;
  let rocketOffset = new THREE.Vector3();

  const loader = new GLTFLoader();
  const modelUrl = new URL("./rocket_test.glb", import.meta.url).href;

  loader.load(
    modelUrl,
    (gltf) => {
      rocketModel = gltf.scene;
      scene.add(rocketModel);

      const box = new THREE.Box3().setFromObject(rocketModel);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        rocketModel.scale.setScalar(4 / maxDim);
      }

      const scaledBox = new THREE.Box3().setFromObject(rocketModel);
      rocketOffset.copy(scaledBox.getCenter(new THREE.Vector3()));
      rocketModel.position.sub(rocketOffset);

      rocketModel.traverse((child) => {
        if (child.isMesh) child.frustumCulled = false;
      });

      rocketModel.add(camera);
      camera.position.set(0, 6, 10);
      camera.lookAt(rocketModel.position);
    },
    undefined,
    (error) => console.error("Error loading GLB:", error)
  );

  let startAlt = null;
  let smoothedAlt = null;
  const velocity = new THREE.Vector3(0, 0, 0);
  const MAX_SPEED = 50;
  const altHistory = [];
  const HISTORY_MS = 200;

  window.api.on("data", (telem) => {
    if (!telem) return;

    const now = performance.now();
    const altitude = Number(telem.altitude ?? 0);
    const orientation = telem.orientation ?? [0, 0, 0];

    if (startAlt == null) {
      startAlt = altitude;
      smoothedAlt = altitude;
      targetPosition.set(0, 6.5, 0);
    }

    // Adaptive EMA — ramps up aggressively when raw signal diverges from
    // the smoothed value (e.g. at apogee reversal), so the smoother catches
    // direction changes instead of lagging through them.
    const error = altitude - smoothedAlt;
    const adaptiveSmooth = Math.min(0.2 + (Math.abs(error) / 50) * 0.6, 0.8);
    smoothedAlt = smoothedAlt + adaptiveSmooth * error;

    const yPos = (smoothedAlt - startAlt) * 1;

    altHistory.push({ alt: yPos, time: now });
    while (altHistory.length > 1 && now - altHistory[0].time > HISTORY_MS) {
      altHistory.shift();
    }

    if (altHistory.length >= 2) {
      const oldest = altHistory[0];
      const newest = altHistory[altHistory.length - 1];
      const windowDt = (newest.time - oldest.time) / 1000;

      if (windowDt > 0.01) {
        const dydt = (newest.alt - oldest.alt) / windowDt;

        // Take direction from the raw signal delta rather than the smoothed
        // window — this ensures velocity flips negative the moment the rocket
        // starts descending, regardless of smoothing lag.
        const prevAlt = altHistory[altHistory.length - 2]?.alt ?? newest.alt;
        const rawDelta = newest.alt - prevAlt;
        const direction = rawDelta >= 0 ? 1 : -1;
        const magnitude = Math.min(Math.abs(dydt), MAX_SPEED);

        velocity.set(0, magnitude * direction, 0);
      }
    }

    targetRotation.set(
      THREE.MathUtils.degToRad(Number(orientation[0] ?? 0)),
      THREE.MathUtils.degToRad(Number(orientation[1] ?? 0)),
      THREE.MathUtils.degToRad(Number(orientation[2] ?? 0)),
      "XYZ"
    );
  });

  let lastFrameTime = performance.now();

  function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    targetPosition.addScaledVector(velocity, dt);

    // Hard floor — rocket can never go below launch altitude
    targetPosition.y = Math.max(targetPosition.y, 0);

    if (rocketModel) {
      rocketModel.position.set(
        targetPosition.x - rocketOffset.x,
        targetPosition.y - rocketOffset.y,
        targetPosition.z - rocketOffset.z
      );

      // --- UPDATE INFINITE GROUND ---
      infiniteGround.position.x = rocketModel.position.x;
      infiniteGround.position.z = rocketModel.position.z;

      const worldToTextureScale = 20000 / textureRepeatScale;
      groundTexture.offset.x = rocketModel.position.x / worldToTextureScale;
      groundTexture.offset.y = -rocketModel.position.z / worldToTextureScale;
      // ------------------------------

      rocketModel.rotation.x = THREE.MathUtils.lerp(rocketModel.rotation.x, targetRotation.x, 0.1);
      rocketModel.rotation.y = THREE.MathUtils.lerp(rocketModel.rotation.y, targetRotation.y, 0.1);
      rocketModel.rotation.z = THREE.MathUtils.lerp(rocketModel.rotation.z, targetRotation.z, 0.1);
    }

    renderer.render(scene, camera);
  }

  animate();

  function onResize() {
    const { width, height } = getSize();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  const ro = new ResizeObserver(onResize);
  ro.observe(mount);

  return () => {
    ro.disconnect();
    renderer.dispose();
    mount.innerHTML = "";
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountRocketScene);
} else {
  mountRocketScene();
}