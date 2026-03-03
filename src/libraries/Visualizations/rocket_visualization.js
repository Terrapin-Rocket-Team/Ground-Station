import * as THREE from "three";

function mountRocketScene() {
  // Use the dedicated mount point inside rocket-wrapper
  const mount = document.querySelector("#rocket");
  if (!mount) {
    console.error("No #rocket element found to mount Three.js scene.");
    return;
  }

  mount.innerHTML = "";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("skyblue");

  const getSize = () => {
    const { clientWidth, clientHeight } = mount;
    return {
      width: Math.max(1, clientWidth),
      height: Math.max(1, clientHeight),
    };
  };

  const { width, height } = getSize();

  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
  camera.position.set(0, 0, 10);

  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.MeshBasicMaterial({ color: "white" });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);

  mount.appendChild(renderer.domElement);

  function animate() {
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
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
    geometry.dispose();
    material.dispose();
    mount.innerHTML = "";
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountRocketScene);
} else {
  mountRocketScene();
}