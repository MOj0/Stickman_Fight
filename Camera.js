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

    update(dt, player, mPlayer, otherPlayers)
    {
        const c = this;

        player.rotation[1] = c.rotation[1]; // Lock player's Y rotation to camera's Y rotation

        // Note: the formulas are changed, because the player is rotated 180 deg
        const forward = vec3.set(vec3.create(), Math.sin(player.rotation[1]), 0, Math.cos(player.rotation[1]));
        const right = vec3.set(vec3.create(), -Math.cos(player.rotation[1]), 0, Math.sin(player.rotation[1]));

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

        const isMoving = this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD'];

        // 2: update velocity
        vec3.scaleAndAdd(player.velocity, player.velocity, acc, dt * player.acceleration);

        // 3: if no movement, apply friction
        if (!isMoving)
        {
            vec3.scale(player.velocity, player.velocity, 1 - player.friction);
        }

        // 4: limit speed
        const len = vec3.len(player.velocity);
        if (len > player.maxSpeed)
        {
            vec3.scale(player.velocity, player.velocity, player.maxSpeed / len);
        }

        // 5: update translation / Collision detection?
        let canMove = player.currAnimation != "Dies";
        vec3.scaleAndAdd(player.translation, player.translation, player.velocity, dt);
        if (Math.sqrt(Math.pow(player.translation[0], 2) + Math.pow(player.translation[2], 2)) >= 300)
        {
            canMove = false;
        }
        for (let otherPlayer of otherPlayers)
        {
            if (Math.abs(player.translation[0] - otherPlayer.x) + Math.abs(player.translation[2] - otherPlayer.y) < otherPlayer.r)
            {
                canMove = false;
            }
        }
        if (!canMove)
        {
            let tmpVelocity = [0, 0, 0];
            vec3.mul(tmpVelocity, player.velocity, [-1, 1, -1]);
            vec3.scaleAndAdd(player.translation, player.translation, tmpVelocity, dt);
        }

        // Update the final transform
        const t = player.transform;
        mat4.identity(t);
        mat4.translate(t, t, player.translation);
        mat4.rotateY(t, t, player.rotation[1]);

        // Update camera transform
        mat4.identity(c.transform);
        mat4.rotateY(c.transform, c.transform, player.rotation[1] + Math.PI);
        mat4.rotateX(c.transform, c.transform, c.rotation[0]);

        // Reset animations
        if (player.resetAnimation)
        {
            player.currAnimation = isMoving ? "Run" : "Idle";
        }
        
        // If animation can be reset and player is attacking => override the animation
        if (player.resetAnimation && !player.currAnimation.startsWith("Hit"))
        {
            if (this.keys["ArrowLeft"])
            {
                player.currAnimation = "Punch_L";
                player.resetAnimation = false;
                mPlayer.hitWithDelay(0, 600);
            }
            if (this.keys["ArrowRight"])
            {
                player.currAnimation = "Punch_R";
                player.resetAnimation = false;
                mPlayer.hitWithDelay(0, 600);
            }
            if (this.keys["ArrowUp"])
            {
                player.currAnimation = "Kick_L";
                player.resetAnimation = false;
                mPlayer.hitWithDelay(0, 600);
            }
            if (this.keys["ArrowDown"])
            {
                player.currAnimation = "Kick_R";
                player.resetAnimation = false;
                mPlayer.hitWithDelay(0, 600);
            }
        }
        mPlayer.currAnimation = player.currAnimation;
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
        this.viewDistance = Math.min(30, Math.max(8, this.viewDistance + e.deltaY / 200));
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
