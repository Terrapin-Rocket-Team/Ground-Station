import * as BABYLON from 'babylon.js';

class Renderer {
    constructor(sourceDiv) {
        this.canvas = document.getElementById(sourceDiv);
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = new BABYLON.Scene(this.engine);
        this.camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 0, -10), this.scene);
        this.camera.setTarget(BABYLON.Vector3.Zero());
        this.camera.attachControl(this.canvas, false);
        this.light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
        this.box = BABYLON.MeshBuilder.CreateBox("box", { size: 2 }, this.scene);
        this.engine.runRenderLoop(() => this.scene.render());

        window.addEventListener("resize", () => this.engine.resize());
    }
}

const canvas = document.getElementById("babylon-0");