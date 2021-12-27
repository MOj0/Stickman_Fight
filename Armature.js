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

        for (const bone of this.bones)
        {
            bone.localMatrix = mat4.create();
            bone.worldMatrix = mat4.create();
            bone.inverseBindpose = mat4.create();
            bone.offsetMatrix = mat4.create();
        }
        this.setBindPose();
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


    // Returns bone matrices for the current frame
    getBoneMatrices(animation, keyframe, lerpVal)
    {
        const flat = [];
        const nKeyframes = animation.nKeyframes;

        for (const i in this.bones)
        {
            const bone = this.bones[i];
            let rotation0, rotation1, translation0, translation1, scale0, scale1;

            if (animation[bone.name] == undefined || animation[bone.name] == null)
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
                // TODO: Use ACTUAL keyframe values (samples[index].t)
                rotation0 = animation[bone.name].rotation.samples[keyframe % nKeyframes].v;
                rotation1 = animation[bone.name].rotation.samples[(keyframe + 1) % nKeyframes].v;

                translation0 = animation[bone.name].translation.samples[keyframe % nKeyframes].v;
                translation1 = animation[bone.name].translation.samples[(keyframe + 1) % nKeyframes].v;

                scale0 = animation[bone.name].scale.samples[keyframe % nKeyframes].v;
                scale1 = animation[bone.name].scale.samples[(keyframe + 1) % nKeyframes].v;
            }

            // const worldMatrix = parentWorldMatrices[i] = mat4.create(); // Calculated world matrix for bone
            const localMatrix = mat4.create(); // Local matrix
            const offsetMatrix = mat4.create(); // Final matrix to apply to the weighted vertices
            const lquat = quat.create();
            const lvecTranslate = vec3.create();
            const lvecScale = vec3.create();

            // Spherical linear interpolation between the two bones' rotations,
            quat.slerp(lquat, rotation0, rotation1, lerpVal);
            // Lerp translation
            vec3.lerp(lvecTranslate, translation0, translation1, lerpVal);
            // Lerp scale
            vec3.lerp(lvecScale, scale0, scale1, lerpVal);

            mat4.fromRotationTranslationScale(localMatrix, lquat, lvecTranslate, lvecScale);

            // Use the bone hierarchy, important: all parents must be evaluated BEFORE their children
            if (bone.parent == null || bone.parent == -1)
            {
                mat4.copy(bone.worldMatrix, localMatrix);
            }
            else
            {
                mat4.multiply(bone.worldMatrix, this.bones[bone.parent].worldMatrix, localMatrix);
            }

            // Get the offset matrix = worldMatrix * bone's inverse bindpose
            mat4.multiply(offsetMatrix, bone.worldMatrix, bone.inverseBindpose);

            flat.push.apply(flat, offsetMatrix); // Apply also flattens the nested arrays
        }

        return new Float32Array(flat);
    }
}