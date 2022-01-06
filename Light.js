import { Node } from './Node.js';

export class Light extends Node
{
    constructor()
    {
        super();

        Object.assign(this, {
            name: "Light",
            position: [-4, 7, 0],
            ambient: 0.7,
            diffuse: 1,
            specular: 1,
            shininess: 5,
            color: [255, 255, 255],
            attenuatuion: [1.0, 0, 0.02]
        });
    }
}