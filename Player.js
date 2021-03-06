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

        this.velocity = vec3.set(vec3.create(), 0, 0, 0);
        this.maxSpeed = 23;
        this.friction = 1;
        this.acceleration = 100;
        this.completedCombo = false;
        this.resetAnimation = true;

        this.armature.playerRef = this;
    }

    getAnimation(name = null)
    {
        for(const animation of this.animations)
        {
            if(name === null && animation.name === this.currAnimation || name != null && animation.name == name)
            {
                return animation;
            }
        }
        return null;
    }

    getAnimationBoneMatrices(sinceStart)
    {
        return this.armature.getBoneMatricesCombos(this.getAnimation(), sinceStart);
    }
}