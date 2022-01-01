import { mat4, vec3, quat } from "./lib/gl-matrix-module.js";
import { Utils } from "./Utils.js";

export class Node
{
    constructor(options)
    {
        this.children = []; // Children have to be initialized first!
        this.parent = null;

        // NOTE: Node.defaults are behaving strangely, so a hardcoded object is used instead
        Utils.init(this, {translation: [0, 0, 0],rotation: [0, 0, 0],scale: [1, 1, 1],aabb: {min: [0, 0, 0],max: [0, 0, 0],},},
            options);
        
        // Utils.init(this, Node.defaults, options); // NOTE: Causes bugs when adding new objects all the time

        this.transform = mat4.create(); // "local" transform of current node
        this.updateTransform();
    }

    updateTransform()
    {
        const t = this.transform;
        const degrees = this.rotation.map(x => x * 180 / Math.PI);
        const q = quat.fromEuler(quat.create(), ...degrees);
        const v = vec3.clone(this.translation);
        const s = vec3.clone(this.scale);
        mat4.fromRotationTranslationScale(t, q, v, s);
    }

    getGlobalTransform()
    {
        if (!this.parent) // base case
        {
            return mat4.clone(this.transform);
        }
        // traverse the tree upward
        const transform = this.parent.getGlobalTransform();
        return mat4.mul(transform, transform, this.transform);
    }

    addChild(node)
    {
        this.children.push(node)
        node.parent = this;
    }

    removeChild(node)
    {
        const index = this.children.indexOf(node);
        if (index >= 0)
        {
            this.children.splice(index, 1);
            node.parent = null;
        }
    }

    // Helper function to traverse the whole tree
    // Runs functions before and after on the current node and all its children
    traverse(before, after)
    {
        if (before) // Before we traverse, apply function to current node
        {
            before(this);
        }
        for (const child of this.children) // traverse
        {
            child.traverse(before, after);
        }
        if (after)
        {
            after(this);
        }
    }
}


Node.defaults = {
    translation: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    aabb: {
        min: [0, 0, 0],
        max: [0, 0, 0],
    },
};
