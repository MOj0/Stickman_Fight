import { Node } from "./Node.js";
import { vec3 } from './lib/gl-matrix-module.js';

export class Player extends Node
{
    constructor(options = {})
    {
        super(options);

        this.velocity = vec3.set(vec3.create(), 0, 0, 0);
        this.maxSpeed = 3;
        this.friction = 0.2;
        this.acceleration = 20;

        // TODO:
        // this.armature = ...
    }
}