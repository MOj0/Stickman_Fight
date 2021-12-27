"use strict";

import { mat4 } from './lib/gl-matrix-module.js';
import { Engine } from './Engine.js';
import { Camera } from './Camera.js';
import { GLTFLoader } from './GLTFLoader.js';
import { Renderer } from './Renderer.js';
import { Node } from './Node.js';
import * as FloorModel from "./floor.js";

document.addEventListener("DOMContentLoaded", () =>
{
    const canvas = document.querySelector("canvas");
    new App(canvas);
});

class App extends Engine
{
    async start()
    {
        /** @type {WebGL2RenderingContext} */
        const gl = this.gl;

        this.pointerlockchangeHandler = this.pointerlockchangeHandler.bind(this);
        this.mousedownHandler = this.mousedownHandler.bind(this);
        document.addEventListener('pointerlockchange', this.pointerlockchangeHandler);
        document.addEventListener('mousedown', this.mousedownHandler);

        const floorModel = this.createModel(FloorModel);
        const greenTexture = Engine.createTexture(gl, {
            data: new Uint8Array([0, 255, 0, 255]),
            width: 1,
            height: 1
        });

        this.floor = new Node({
            name: "Floor",
            model: floorModel,
            texture: greenTexture
        });
        mat4.fromScaling(this.floor.transform, [30, 1, 30]);

        this.loader = new GLTFLoader();

        await this.loader.load("./assets/models/stickman/stickman.gltf");
        // await this.loader.load("./assets/models/character/character.gltf");

        this.scene = await this.loader.loadScene(this.loader.defaultScene);
        this.scene.addNode(this.floor);

        this.player = this.scene.getNodeByName("Armature");
        this.camera = new Camera();
        this.player.addChild(this.camera);
        
        // All nodes are loaded
        console.log("Nodes in the scene", this.scene.nodes);

        this.renderer = new Renderer(this.gl);
        this.renderer.prepareScene(this.scene);
    }


    update()
    {
        this.time = Date.now();
        const dt = (this.time - this.startTime) * 0.001;
        this.startTime = this.time;
        this.sinceStart = (this.sinceStart + dt) % 100;

        if (this.camera)
        {
            this.camera.update(dt);
        }
    }

    /**
     * @param {DOMHighResTimeStamp} sinceStart Current time (based on the number of milliseconds since document load)
     */
    render(sinceStart)
    {
        if (this.renderer && this.camera)
        {
            this.renderer.render(this.scene, this.camera, sinceStart);
        }
    }

    pointerlockchangeHandler()
    {
        if (document.pointerLockElement === this.canvas && this.camera)
        {
            this.camera.enable();
        }
        else
        {
            this.camera.disable();
        }
    }

    mousedownHandler(e)
    {
        this.canvas.requestPointerLock();
    }

    createModel(model)
    {
        /** @type {WebGL2RenderingContext} */
        const gl = this.gl;

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, model.vertices, gl.STATIC_DRAW);

        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indices, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);

        gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 16);

        const numTriangles = model.indices.length;
        return { vao, indices: numTriangles };
    }

}