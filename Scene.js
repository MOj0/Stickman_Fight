export class Scene
{
    constructor(options = {})
    {
        this.nodes = [...(options.nodes || [])];
    }

    addNode(node)
    {
        this.nodes.push(node);
    }

    traverse(before, after)
    {
        this.nodes.forEach(node => node.traverse(before, after));
    }

    clone()
    {
        return new Scene({
            ...this,
            nodes: this.nodes.map(node => node.clone()),
        });
    }

    getNodeByName(name)
    {
        for (const node of this.nodes)
        {
            if (node.name !== undefined && node.name == name)
            {
                return node;
            }
        }
        return null;
    }
}