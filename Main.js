import { Engine } from "./Engine.js";
import { shaders } from "./shaders.js";
import { mat4, vec3 } from './lib/gl-matrix-module.js';
import { GUI } from './lib/dat.gui.module.js';
import { Node } from "./Node.js";
import * as FloorModel from "./floor.js";
import * as CubeModel from "./cube.js";


document.addEventListener("DOMContentLoaded", () =>
{
    const canvas = document.querySelector("canvas");
    const app = new App(canvas);
    const gui = new GUI();

    gui.add(app.camera, 'mouseSensitivity', 0.0001, 0.01);
    gui.add(app.cube, 'maxSpeed', 0, 10);
    gui.add(app.cube, 'friction', 0.05, 0.75);
    gui.add(app.cube, 'acceleration', 1, 100);
});


class App extends Engine
{
    initGL()
    {
        /** @type {WebGL2RenderingContext} */
        const gl = this.gl;

        gl.clearColor(0.45, 0.7, 1, 1);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        this.programs = Engine.buildPrograms(gl, shaders);
    }

    initHandlers()
    {
        this.pointerlockchangeHandler = this.pointerlockchangeHandler.bind(this);
        this.mousemoveHandler = this.mousemoveHandler.bind(this);
        this.keydownHandler = this.keydownHandler.bind(this);
        this.keyupHandler = this.keyupHandler.bind(this);
        this.wheelHandler = this.wheelHandler.bind(this);
        this.mousedownHandler = this.mousedownHandler.bind(this);
        this.keys = {};

        document.addEventListener('pointerlockchange', this.pointerlockchangeHandler);
        document.addEventListener('mousedown', this.mousedownHandler);
        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
        document.addEventListener('wheel', this.wheelHandler);
    }

    start()
    {
        /** @type {WebGL2RenderingContext} */
        const gl = this.gl;

        this.initGL();
        this.initHandlers();

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

        this.root = new Node();

        this.floor = new Node();
        this.floor.model = floorModel;
        this.floor.texture = greenTexture;
        this.root.addChild(this.floor);
        mat4.fromScaling(this.floor.transform, [10, 1, 10]);

        this.cube = new Node();
        mat4.fromTranslation(this.cube.transform, [0, 1, -5]);
        this.root.addChild(this.cube);

        // Use this method instead of this.cube.model = ...
        Object.assign(this.cube, {
            model: cubeModel,
            texture: blueTexture,
            rotation: vec3.set(vec3.create(), 0, 0, 0),
            translation: vec3.set(vec3.create(), 0, 1, 0),
            velocity: vec3.set(vec3.create(), 0, 0, 0),
            maxSpeed: 3,
            friction: 0.2,
            acceleration: 20
        });

        this.camera = new Node(); // Camera is just another node
        // mat4.fromTranslation(this.camera.transform, [0, 1, this.viewDistance]);
        this.cube.addChild(this.camera);

        // Use this method instead of this.camera.projection = ...
        Object.assign(this.camera, {
            projection: mat4.create(),
            rotation: vec3.set(vec3.create(), 0, 0, 0),
            translation: vec3.set(vec3.create(), 0, 0, 0),
            mouseSensitivity: 0.002,
        });
    }

    update()
    {
        this.time = Date.now();
        const dt = (this.time - this.startTime) * 0.001;
        this.startTime = this.time;

        const camera = this.camera;
        const cube = this.cube;

        cube.rotation[1] = camera.rotation[1];

        const forward = vec3.set(vec3.create(),
            -Math.sin(cube.rotation[1]), 0, -Math.cos(cube.rotation[1]));
        const right = vec3.set(vec3.create(),
            Math.cos(cube.rotation[1]), 0, -Math.sin(cube.rotation[1]));

        // 1: add movement acceleration
        let acc = vec3.create();
        if (this.keys['KeyW'])
        {
            vec3.add(acc, acc, forward);
        }
        if (this.keys['KeyS'])
        {
            vec3.sub(acc, acc, forward);
        }
        if (this.keys['KeyD'])
        {
            vec3.add(acc, acc, right);
        }
        if (this.keys['KeyA'])
        {
            vec3.sub(acc, acc, right);
        }

        // 2: update velocity
        vec3.scaleAndAdd(cube.velocity, cube.velocity, acc, dt * cube.acceleration);

        // 3: if no movement, apply friction
        if (!this.keys['KeyW'] &&
            !this.keys['KeyS'] &&
            !this.keys['KeyD'] &&
            !this.keys['KeyA'])
        {
            vec3.scale(cube.velocity, cube.velocity, 1 - cube.friction);
        }

        // 4: limit speed
        const len = vec3.len(cube.velocity);
        if (len > cube.maxSpeed)
        {
            vec3.scale(cube.velocity, cube.velocity, cube.maxSpeed / len);
        }

        // 5: update translation
        vec3.scaleAndAdd(cube.translation, cube.translation, cube.velocity, dt);

        // Update the final transform
        const t = cube.transform;
        mat4.identity(t);
        mat4.translate(t, t, cube.translation);
        mat4.rotateY(t, t, cube.rotation[1]); // Update with camera rotation so its the same
        mat4.rotateX(t, t, cube.rotation[0]);

        // Update camera rotation
        mat4.identity(camera.transform);
        mat4.rotateX(camera.transform, camera.transform, camera.rotation[0]);
    }

    render()
    {
        /** @type {WebGL2RenderingContext} */
        const gl = this.gl;
        const program = this.programs.shader;

        gl.useProgram(program.program);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(program.uniforms.uTexture, 0);

        const cameraMatrix = this.camera.getGlobalTransform();
        mat4.translate(cameraMatrix, cameraMatrix, [0, 0, this.viewDistance]);
        
        const cameraPosition = [cameraMatrix[12], cameraMatrix[13], cameraMatrix[14]];
        const cubePosition = [this.cube.transform[12], this.cube.transform[13], this.cube.transform[14]];
        const up = [0, 1, 0];
        const viewMatrix = mat4.lookAt(mat4.create(), cameraPosition, cubePosition, up); // look at the cube

        // Tree traversal rendering
        let mvpMatrix = mat4.create();
        let mvpStack = [];
        const mvpLocation = program.uniforms.uModelViewProjection;
        mat4.mul(mvpMatrix, this.camera.projection, viewMatrix);

        this.root.traverse(
            node =>
            {
                mvpStack.push(mat4.clone(mvpMatrix));
                mat4.mul(mvpMatrix, mvpMatrix, node.transform);
                if (node.model)
                {
                    gl.bindVertexArray(node.model.vao);
                    gl.uniformMatrix4fv(mvpLocation, false, mvpMatrix);
                    gl.bindTexture(gl.TEXTURE_2D, node.texture);
                    gl.drawElements(gl.TRIANGLES, node.model.indices, gl.UNSIGNED_SHORT, 0);
                }
            },
            _ =>
            {
                mvpMatrix = mvpStack.pop();
            }
        );
    }

    resize()
    {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        const aspect = w / h;
        const FOVy = Math.PI / 2;
        const near = 0.1;
        const far = 100;

        mat4.perspective(this.camera.projection, FOVy, aspect, near, far);
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
            this.canvas.addEventListener("mousemove", this.mousemoveHandler)
        }
        else
        {
            this.canvas.removeEventListener("mousemove", this.mousemoveHandler);
        }
    }

    mousemoveHandler(e)
    {
        const dx = e.movementX;
        const dy = e.movementY;
        const c = this.camera;
        c.rotation[0] -= dy * c.mouseSensitivity;
        c.rotation[1] -= dx * c.mouseSensitivity;

        const pi = Math.PI;
        const twopi = pi * 2;
        const halfpi = pi / 2 - 0.01; // Add a small decimal to get rid of edge case

        c.rotation[0] = Math.min(0, Math.max(-halfpi, c.rotation[0]));

        // Constrain yaw to range [0, pi * 2], we don't want huge angles because of floating point rounding error
        c.rotation[1] = ((c.rotation[1] % twopi) + twopi) % twopi;
    }

    keydownHandler(e)
    {
        this.keys[e.code] = true;
    }

    keyupHandler(e)
    {
        this.keys[e.code] = false;
    }

    mousedownHandler(e)
    {
        this.canvas.requestPointerLock();
    }

    wheelHandler(e)
    {
        this.viewDistance += e.deltaY / 200;
    }
}