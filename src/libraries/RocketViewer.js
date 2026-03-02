import * as THREE from 'three';

// basic setup for the scene
export function RocketScene(container) {
    console.log(container);
    let scene = new THREE.Scene();

    // scene details
    let sceneContainer = container;
    scene.background = new THREE.Color("skyblue");
    let camera = new THREE.PerspectiveCamera(35, (sceneContainer.clientWidth / sceneContainer.clientHeight), 0.1, 100);

    // scene renderer
    let renderer = new THREE.WebGLRenderer();
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // build up our scene post-setup
    camera.position.set(0, 0, 10);

    let box = new THREE.BoxGeometry(10, 10, 10);
    let texture = new THREE.MeshBasicMaterial();
    let cube = new THREE.Mesh(box, texture);

    scene.add(cube);

    renderer.render(scene, camera);
};

let container = document.getElementById("rocket-wrapper");
RocketScene(container);
