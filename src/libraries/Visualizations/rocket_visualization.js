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

  // necessary rotational information for the cube
  const targetPosition = new THREE.Vector3(0, 0, 0);
  const targetRotation = new THREE.Euler(0, 0, 0, "XYZ");
  const tempEuler = new THREE.Euler(0, 0, 0, "XYZ");

  scene.add(cube);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);

  mount.appendChild(renderer.domElement);

  let startAlt = null;
  window.api.on("data", (telem) => {
    if (!telem) {
      console.log("error in recieving telemetry");
      return;
    }

    const altitude = Number(telem.altitude ?? 0); // numerical quntity
    const orientation = telem.orientation ?? [0, 0, 0]; // vectorial quantity?

    if (startAlt == null) {startAlt = altitude;}

    const y_change = (altitude - startAlt) * 0.05; // movement rate
    targetPosition.set(0, y_change, 0);

    targetRotation.set(
      THREE.MathUtils.degToRad(Number(orientation[0] ?? 0)),
      THREE.MathUtils.degToRad(Number(orientation[1] ?? 0)),
      THREE.MathUtils.degToRad(Number(orientation[2] ?? 0)),
      "XYZ"
    );
  });


  function animate() {
    cube.position.lerp(targetPosition, 0.15);
  
    cube.rotation.x = THREE.MathUtils.lerp(cube.rotation.x, targetRotation.x, 0.15);
    cube.rotation.y = THREE.MathUtils.lerp(cube.rotation.y, targetRotation.y, 0.15);
    cube.rotation.z = THREE.MathUtils.lerp(cube.rotation.z, targetRotation.z, 0.15);

    // move the camera w/ cube
    camera.position.copy(cube.position).add(new THREE.Vector3(0, 3, 10)); // offset camera position
    camera.lookAt(cube.position);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);

    console.log(cube.rotation);
    console.log(cube.position);
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