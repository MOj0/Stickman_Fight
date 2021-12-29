import { vec3, mat4, quat } from './lib/gl-matrix-module.js';

export class Armature
{
    /**
     * This class is the Armature / Skeleton / Skin 
     * which also has localMatrix, worldMatrix, inverseBindpose
     * so the bones are ready for animation
     * @param {Array} skin Array of loaded joints
     */
    constructor(skin)
    {
        this.bones = skin;
        this.animationCompleted = true;
        this.currentAnimation = null;
        this.animationStart = null; // Used to start the attack animations from keyframe 0
        this.playerRef = null;

        this.animationNameMap = {
            Punch_L: 0,
            Kick_L: 1,
            Punch_R: 2,
            Kick_R: 3,
        };

        this.allCombos = [[0, 2, 1, 3], [0, 0, 3], [0, 2, 0, 1, 3]]; // TODO: Add more combos?
        this.comboIndex = 0;
        this.currComboChain = JSON.parse(JSON.stringify(this.allCombos)); // Deep copy allCombos

        console.log("The combos are:");
        for(const combo of this.allCombos)
        {
            console.log(combo.map(value => this.getKeyByValue(this.animationNameMap, value)));
        }

        for (const bone of this.bones)
        {
            bone.localMatrix = mat4.create();
            bone.worldMatrix = mat4.create();
            bone.inverseBindpose = mat4.create();
            bone.offsetMatrix = mat4.create(); // Final matrix to apply to the weighted vertices
        }
        this.setBindPose();
    }

    getKeyByValue(object, value)
    {
        return Object.keys(object).find(key => object[key] === value);
    }

    setBindPose()
    {
        for (const bone of this.bones)
        {
            const parentBone = (bone.parent != null && bone.parent != -1) ? this.bones[bone.parent] : null;

            //Calc Local matrix
            mat4.fromRotationTranslation(bone.localMatrix, bone.rotation, bone.translation);

            //Calculate the World Quaternion and Position
            if (parentBone != null)
            {
                //world = p.world * local
                mat4.multiply(bone.worldMatrix, parentBone.worldMatrix, bone.localMatrix);
            }
            else
            {
                //no parent, local is world
                mat4.copy(bone.worldMatrix, bone.localMatrix);
            }

            //Now we invert the world matrix which creates our bind pose,
            //a starting point to check for changes in the world matrix
            mat4.invert(bone.inverseBindpose, bone.worldMatrix);
        }
    }

    setPlayerRef(player)
    {
        this.playerRef = player;
    }

    // Returns bone matrices for the current frame
    getBoneMatrices(animation, sinceStart)
    {
        if (this.animationCompleted || this.currentAnimation == null || this.currentAnimation.name == "Idle" || this.currentAnimation.name == "Run")
        {
            this.currentAnimation = animation;
            this.animationCompleted = false;

            // If the animation is Idle or Run, we don't need to start it from 0, since it loops anyways
            this.animationStart = this.currentAnimation.name == "Idle" || this.currentAnimation.name == "Run" ? 0 : sinceStart;
        }

        const flat = [];
        const nKeyframes = this.currentAnimation.nKeyframes;

        // Improved animations slightly
        const delta = sinceStart - this.animationStart;
        const maxMs = this.currentAnimation.maxKeyframe * 3000; // 3000 = 1000 (sec -> ms)  *  3 (3 times slower animations)
        const t = (delta % maxMs) / maxMs;
        const a = t * this.currentAnimation.nKeyframes;
        const currKeyframe = ~~(a); // Fast Math.floor
        const lerp = a - currKeyframe;

        if (currKeyframe >= this.currentAnimation.nKeyframes - 1)
        {
            this.animationCompleted = true;
        }

        // Combos
        if (this.animationCompleted && this.currentAnimation.name != "Idle" && this.currentAnimation.name != "Run" && this.currentAnimation.name != "Tired") // Player is attacking
        {
            const currAttack = this.animationNameMap[this.currentAnimation.name];
            for (let i = this.currComboChain.length - 1; i >= 0; i--)
            {
                const combo = this.currComboChain[i];
                if (combo[this.comboIndex] != currAttack)
                {
                    this.currComboChain.splice(i, 1);
                }
            }
            // Either failed the combo or fully completed it
            if (this.currComboChain.length == 0 || this.currComboChain.length == 1 && this.comboIndex == this.currComboChain[0].length - 1)
            {
                console.log((this.currComboChain.length == 0 ? "FAILED" : "COMPLETED") + " COMBO");
                this.playerRef.completedCombo = this.currComboChain.length != 0;
                
                if (this.currComboChain.length == 0)
                {
                    this.playerRef.currAnimation = "Tired"
                    this.currentAnimation = this.playerRef.getAnimation();
                    this.animationCompleted = false;
                }

                this.comboIndex = 0;
                this.currComboChain = JSON.parse(JSON.stringify(this.allCombos)); // Deep copy allCombos
            }
            else
            {
                this.comboIndex++; // Go to the next index in the combo chain
            }
        }

        for (const i in this.bones)
        {
            const bone = this.bones[i];
            let rotation0, rotation1, translation0, translation1, scale0, scale1;

            if (this.currentAnimation[bone.name] == undefined || this.currentAnimation[bone.name] == null)
            {
                rotation0 = quat.create();
                rotation1 = rotation0;

                translation0 = vec3.create();
                translation1 = translation0;

                scale0 = vec3.fromValues(1, 1, 1);
                scale0 = scale1;
            }
            else
            {
                rotation0 = this.currentAnimation[bone.name].rotation.samples[currKeyframe].v;
                rotation1 = this.currentAnimation[bone.name].rotation.samples[(currKeyframe + 1) % nKeyframes].v;

                translation0 = this.currentAnimation[bone.name].translation.samples[currKeyframe].v;
                translation1 = this.currentAnimation[bone.name].translation.samples[(currKeyframe + 1) % nKeyframes].v;

                scale0 = this.currentAnimation[bone.name].scale.samples[currKeyframe].v;
                scale1 = this.currentAnimation[bone.name].scale.samples[(currKeyframe + 1) % nKeyframes].v;
            }

            const lquat = quat.create();
            const lvecTranslate = vec3.create();
            const lvecScale = vec3.create();

            // Spherical linear interpolation between the two bones' rotations,
            quat.slerp(lquat, rotation0, rotation1, lerp);
            // Lerp translation
            vec3.lerp(lvecTranslate, translation0, translation1, lerp);
            // Lerp scale
            vec3.lerp(lvecScale, scale0, scale1, lerp);

            mat4.fromRotationTranslationScale(bone.localMatrix, lquat, lvecTranslate, lvecScale);

            // Use the bone hierarchy, important: all parents must be evaluated BEFORE their children
            if (bone.parent == null || bone.parent == -1)
            {
                mat4.copy(bone.worldMatrix, bone.localMatrix);
            }
            else
            {
                mat4.multiply(bone.worldMatrix, this.bones[bone.parent].worldMatrix, bone.localMatrix);
            }

            // Get the offset matrix = worldMatrix * bone's inverse bindpose
            mat4.multiply(bone.offsetMatrix, bone.worldMatrix, bone.inverseBindpose);

            flat.push.apply(flat, bone.offsetMatrix); // Apply also flattens the nested arrays
        }

        return new Float32Array(flat);
    }
}