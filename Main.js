import { Engine } from "./Engine.js";
import { mat4, vec3 } from './lib/gl-matrix-module.js';
// import { GUI } from './lib/dat.gui.module.js';
import { Node } from "./Node.js";
import * as FloorModel from "./floor.js";
import * as CubeModel from "./cube.js";
import { Renderer } from "./Renderer.js";
import { Camera } from "./Camera.js";
import { Scene } from "./Scene.js";
import { Player } from "./Player.js";
import { GLTFLoader } from "./GLTFLoader.js";


document.addEventListener("DOMContentLoaded", () =>
{
    const canvas = document.querySelector("canvas");
    const app = new App(canvas);
    // const gui = new GUI();

    // gui.add(app.camera, 'mouseSensitivity', 0.0001, 0.01);
    // gui.add(app.cube, 'maxSpeed', 0, 10);
    // gui.add(app.cube, 'friction', 0.05, 0.75);
    // gui.add(app.cube, 'acceleration', 1, 100);
});


class App extends Engine
{
    async start()
    {
        /** @type {WebGL2RenderingContext} */
        const gl = this.gl;

        this.loader = new GLTFLoader();
        await this.loader.load("./assets/models/simpleStickman/simpleStickman.gltf"); // also sets defaultScene reference

        this.pointerlockchangeHandler = this.pointerlockchangeHandler.bind(this);
        this.mousedownHandler = this.mousedownHandler.bind(this);
        document.addEventListener('pointerlockchange', this.pointerlockchangeHandler);
        document.addEventListener('mousedown', this.mousedownHandler);

        this.time = Date.now();
        this.startTime = this.time;
        this.viewDistance = 3;

        const floorModel = this.createModel(FloorModel);
        const cubeModel = this.createModel(CubeModel);
        const greenTexture = Engine.createTexture(gl, {
            // options object
            data: new Uint8Array([0, 255, 0, 255]),
            width: 1,
            height: 1
        });
        const blueTexture = Engine.createTexture(gl, {
            // options object
            data: new Uint8Array([0, 0, 255, 255]),
            width: 1,
            height: 1
        });

        this.floor = new Node({
            model:  floorModel,
            texture:  greenTexture
        });
        
        mat4.fromScaling(this.floor.transform, [10, 1, 10]);

        this.player = await this.loader.loadNode("Player");
        // mat4.fromTranslation(this.player.transform, [0, 1, -5]); // doesn't do anything?
        this.player.updateTransform();

        // this.scene = await this.loader.loadScene(this.loader.defaultScene);
        this.scene = new Scene(); // create Scene manually
        this.scene.addNode(this.floor);
        this.scene.addNode(this.player);

        this.camera = new Camera(); // create Camera manually
        this.player.addChild(this.camera);

        this.renderer = new Renderer(gl);
        this.renderer.prepareScene(this.scene);
    }

    update()
    {
        this.time = Date.now();
        const dt = (this.time - this.startTime) * 0.001;
        this.startTime = this.time;

        if (this.camera)
        {
            this.camera.update(dt);
        }

        if (this.physics)
        {
            this.physics.update(dt);
        }
    }

    render()
    {
        if (this.renderer && this.camera)
        {
            this.renderer.render(this.scene, this.camera);
        }
    }

    resize()
    {
        if (this.camera)
        {
            const w = this.canvas.clientWidth;
            const h = this.canvas.clientHeight;
            const aspect = w / h;
            const FOVy = Math.PI / 2;
            const near = 0.1;
            const far = 100;

            mat4.perspective(this.camera.projection, FOVy, aspect, near, far);
        }
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

    pointerlockchangeHandler()
    {
        if (document.pointerLockElement === this.canvas)
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
}