import { mat4} from "./lib/gl-matrix-module.js";

export class Node
{
    constructor()
    {
        this.transform = mat4.create(); // "local" transform of current node
        this.children = [];
        this.parent = null;
    }

    getGlobalTransform()
    {
        if(!this.parent) // base case
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
        if(index >= 0)
        {
            this.children.splice(index, 1);
            node.parent = null;
        }
    }

    // Helper function to traverse the whole tree
    // Runs functions before and after on the current node and all its children
    traverse(before, after)
    {
        if(before) // Before we traverse, apply function to current node
        {
            before(this);
        }
        for(const child of this.children) // traverse
        {
            child.traverse(before, after);
        }
        if(after)
        {
            after(this);
        }
    }
}