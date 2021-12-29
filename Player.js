import { Node } from "./Node.js";
import { vec3 } from './lib/gl-matrix-module.js';
import { Armature } from "./Armature.js";

/**
 * Class representing the Player, it also contains armature and animations!
 */
export class Player extends Node
{
    // NOTE: This type annotation doesn't really work
    /**
     * @param {{armature: Armature}} options 
     */
    constructor(options = {armature : null, animations: null, currAnimation: null})
    {
        super(options);

        this.rotation[1] = Math.PI; // Rotate player so he points in the opposite direction of the camera

        this.velocity = vec3.set(vec3.create(), 0, 0, 0);
        this.maxSpeed = 3;
        this.friction = 0.2;
        this.acceleration = 20;
        this.completedCombo = false;
    }

    getAnimation()
    {
        for(const animation of this.animations)
        {
            if(animation.name == this.currAnimation)
            {
                return animation; 
            }
        }
        return null;
    }
}