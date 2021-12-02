import { mat4, vec3 } from './lib/gl-matrix-module.js';
import { shaders } from "./shaders.js";
import {Engine} from "./Engine.js";

export class Renderer
{
    /** @param {WebGL2RenderingContext} gl */
    constructor(gl)
    {
        this.gl = gl;

        gl.clearColor(0.45, 0.7, 1, 1);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        this.programs = Engine.buildPrograms(gl, shaders);
    }

    render(scene, camera)
    {
        /** @type {WebGL2RenderingContext} */
        const gl = this.gl;
        const program = this.programs.shader;

        gl.useProgram(program.program);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(program.uniforms.uTexture, 0);

        const cameraMatrix = camera.getGlobalTransform();
        mat4.translate(cameraMatrix, cameraMatrix, [0, 0, camera.viewDistance]);
        
        const player = camera.parent;
        const cameraPosition = [cameraMatrix[12], cameraMatrix[13], cameraMatrix[14]];
        const playerPosition = [player.transform[12], player.transform[13], player.transform[14]];
        const up = [0, 1, 0];
        const viewMatrix = mat4.lookAt(mat4.create(), cameraPosition, playerPosition, up); // look at the player

        // Tree traversal rendering
        let mvpMatrix = mat4.create();
        let mvpStack = [];
        const mvpLocation = program.uniforms.uModelViewProjection;
        mat4.mul(mvpMatrix, camera.projection, viewMatrix);

        scene.traverse(
            node =>
            {
                mvpStack.push(mat4.clone(mvpMatrix));
                mat4.mul(mvpMatrix, mvpMatrix, node.transform);
                if (node.model)
                {
                    gl.bindVertexArray(node.model.vao);
                    gl.uniformMatrix4fv(mvpLocation, false, mvpMatrix);
                    gl.bindTexture(gl.TEXTURE_2D, node.texture);
                    gl.drawElements(gl.TRIANGLES, node.model.indices, gl.UNSIGNED_SHORT, 0);
                }
            },
            _ =>
            {
                mvpMatrix = mvpStack.pop();
            }
        );
    }
}