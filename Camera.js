import { Node } from "./Node.js";
import { Utils } from "./Utils.js";
import { mat4, vec3 } from './lib/gl-matrix-module.js';

export class Camera extends Node
{
    constructor(options)
    {
        super(options);
        Utils.init(this, this.constructor.defaults, options);

        this.projection = mat4.create();
        this.updateProjection();

        this.mousemoveHandler = this.mousemoveHandler.bind(this);
        this.keydownHandler = this.keydownHandler.bind(this);
        this.keyupHandler = this.keyupHandler.bind(this);
        this.wheelHandler = this.wheelHandler.bind(this);
        this.keys = {};

        this.twopi = Math.PI * 2;
        this.halfpi = Math.PI / 2 - 0.01;
    }

    // update(dt)
    // {
    //     const c = this;
    //     const player = this.parent;

    //     // c.rotation[1] = player.rotation[1] + Math.PI;

    //     // player.rotation[1] = c.rotation[1];

    //     // Update camera rotation
    //     mat4.identity(c.transform);
    //     mat4.rotateX(c.transform, c.transform, c.rotation[0]);
    // }

    update(dt)
    {
        // TODO: Point the player away from camera (rotateY?)
        const c = this;
        const player = this.parent;

        // player.rotation[1] = c.rotation[1]; // ??

        const forward = vec3.set(vec3.create(), -Math.sin(player.rotation[1]), 0, -Math.cos(player.rotation[1]));
        const right = vec3.set(vec3.create(), Math.cos(player.rotation[1]), 0, -Math.sin(player.rotation[1]));

        // 1: add movement acceleration
        const acc = vec3.create();
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

        const moving = this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD'];

        // 2: update velocity
        vec3.scaleAndAdd(player.velocity, player.velocity, acc, dt * player.acceleration);

        // 3: if no movement, apply friction
        if (!moving)
        {
            vec3.scale(player.velocity, player.velocity, 1 - player.friction);
        }

        // 4: limit speed
        const len = vec3.len(player.velocity);
        if (len > player.maxSpeed)
        {
            vec3.scale(player.velocity, player.velocity, player.maxSpeed / len);
        }

        // 5: update translation
        vec3.scaleAndAdd(player.translation, player.translation, player.velocity, dt);

        // Update the final transform
        const t = player.transform;
        mat4.identity(t);
        mat4.translate(t, t, player.translation);
        mat4.rotateY(t, t, player.rotation[1]);
        // player.updateTransform(); // How about this??

        // Update camera rotation
        mat4.identity(c.transform);
        mat4.rotateX(c.transform, c.transform, c.rotation[0]);

        // Animations
        player.currAnimation = moving ? "Run" : "Idle";
        // player.currAnimation = "Walk_blocking"; // character

        // Override the animation if player is attacking
        if (this.keys["ArrowLeft"])
        {
            player.currAnimation = "Punch_L";
        }
        if (this.keys["ArrowRight"])
        {
            player.currAnimation = "Punch_R";
        }
        if (this.keys["ArrowUp"])
        {
            player.currAnimation = "Kick_L";
        }
        if (this.keys["ArrowDown"])
        {
            player.currAnimation = "Kick_R";
        }
    }

    updateProjection()
    {
        mat4.perspective(this.projection, this.fov, this.aspect, this.near, this.far);
    }

    enable()
    {
        document.addEventListener("keydown", this.keydownHandler);
        document.addEventListener("keyup", this.keyupHandler);
        document.addEventListener("mousemove", this.mousemoveHandler);
        document.addEventListener("wheel", this.wheelHandler);
    }

    disable()
    {
        document.removeEventListener("keydown", this.keydownHandler);
        document.removeEventListener("keyup", this.keyupHandler);
        document.removeEventListener("mousemove", this.mousemoveHandler);
        document.removeEventListener("wheel", this.wheelHandler);

        for (let key in this.keys)
        {
            this.keys[key] = false;
        }
    }

    mousemoveHandler(e)
    {
        const dx = e.movementX;
        const dy = e.movementY;
        const c = this;

        c.rotation[0] -= dy * c.mouseSensitivity;
        c.rotation[1] -= dx * c.mouseSensitivity;

        c.rotation[0] = Math.min(0, Math.max(-this.halfpi, c.rotation[0]));

        // Constrain yaw to range [0, pi * 2], we don't want huge angles because of floating point rounding error
        c.rotation[1] = ((c.rotation[1] % this.twopi) + this.twopi) % this.twopi;
    }

    keydownHandler(e)
    {
        this.keys[e.code] = true;
    }

    keyupHandler(e)
    {
        this.keys[e.code] = false;
    }

    wheelHandler(e)
    {
        this.viewDistance += e.deltaY / 200;
    }
}


Camera.defaults = {
    name: "Camera",
    aspect: 1,
    fov: 1.5,
    near: 0.01,
    far: 100,
    mouseSensitivity: 0.002,
    viewDistance: 12
};
