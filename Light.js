import { Node } from './Node.js';

export class Light extends Node
{
    constructor()
    {
        super();

        Object.assign(this, {
            name: "Light",
            translation: [0, 10, 0],
            ambient: 3,
            diffuse: 1,
            specular: 1,
            shininess: 20,
            color: [255, 255, 255],
            attenuatuion: [1, 0, 0.00008]
        });

        this.updateTransform();
    }
}