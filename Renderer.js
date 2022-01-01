import { vec3, mat4 } from './lib/gl-matrix-module.js';
import { shaders } from "./shaders.js";
import { Engine } from "./Engine.js";
import { Armature } from './Armature.js';
import { Player } from './Player.js';

export class Renderer
{
    /** @param {WebGL2RenderingContext} gl */
    constructor(gl)
    {
        this.gl = gl;
        this.programs = Engine.buildPrograms(gl, shaders);
        this.glObjects = new Map();

        this.timeOld = 0;

        gl.clearColor(0.45, 0.7, 1, 1);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
    }

    prepareBufferView(bufferView)
    {
        if (this.glObjects.has(bufferView))
        {
            return this.glObjects.get(bufferView);
        }

        const buffer = new DataView(
            bufferView.buffer,
            bufferView.byteOffset,
            bufferView.byteLength
        );
        const glBuffer = Engine.createBuffer(this.gl, {
            target: bufferView.target,
            data: buffer
        });
        this.glObjects.set(bufferView, glBuffer);
        return glBuffer;
    }

    prepareSampler(sampler)
    {
        if (this.glObjects.has(sampler))
        {
            return this.glObjects.get(sampler);
        }

        const glSampler = Engine.createSampler(this.gl, sampler);
        this.glObjects.set(sampler, glSampler);
        return glSampler;
    }

    prepareImage(image)
    {
        if (this.glObjects.has(image))
        {
            return this.glObjects.get(image);
        }

        const glTexture = Engine.createTexture(this.gl, { image });
        this.glObjects.set(image, glTexture);
        return glTexture;
    }

    prepareTexture(texture)
    {
        const gl = this.gl;

        this.prepareSampler(texture.sampler);
        const glTexture = this.prepareImage(texture.image);

        const mipmapModes = [
            gl.NEAREST_MIPMAP_NEAREST,
            gl.NEAREST_MIPMAP_LINEAR,
            gl.LINEAR_MIPMAP_NEAREST,
            gl.LINEAR_MIPMAP_LINEAR,
        ];

        if (!texture.hasMipmaps && mipmapModes.includes(texture.sampler.min))
        {
            gl.bindTexture(gl.TEXTURE_2D, glTexture);
            gl.generateMipmap(gl.TEXTURE_2D);
            texture.hasMipmaps = true;
        }
    }

    prepareMaterial(material)
    {
        if (material.baseColorTexture)
        {
            this.prepareTexture(material.baseColorTexture);
        }
        if (material.metallicRoughnessTexture)
        {
            this.prepareTexture(material.metallicRoughnessTexture);
        }
        if (material.normalTexture)
        {
            this.prepareTexture(material.normalTexture);
        }
        if (material.occlusionTexture)
        {
            this.prepareTexture(material.occlusionTexture);
        }
        if (material.emissiveTexture)
        {
            this.prepareTexture(material.emissiveTexture);
        }
    }

    preparePrimitive(primitive)
    {
        if (this.glObjects.has(primitive))
        {
            return this.glObjects.get(primitive);
        }

        this.prepareMaterial(primitive.material);

        const gl = this.gl;
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        if (primitive.indices)
        {
            const bufferView = primitive.indices.bufferView;
            bufferView.target = gl.ELEMENT_ARRAY_BUFFER;
            const buffer = this.prepareBufferView(bufferView);
            gl.bindBuffer(bufferView.target, buffer);
        }

        // This is an application-scoped convention, matching the shader (layout location)
        const attributeNameToIndexMap = {
            POSITION: 0,
            TEXCOORD_0: 1,
            JOINTS_0: 2,
            WEIGHTS_0: 3
        };

        for (const name in primitive.attributes)
        {
            const accessor = primitive.attributes[name];
            const bufferView = accessor.bufferView;
            const attributeIndex = attributeNameToIndexMap[name];

            if (attributeIndex !== undefined)
            {
                bufferView.target = gl.ARRAY_BUFFER;
                const buffer = this.prepareBufferView(bufferView);
                gl.bindBuffer(bufferView.target, buffer);
                gl.enableVertexAttribArray(attributeIndex);
                gl.vertexAttribPointer(
                    attributeIndex,
                    accessor.numComponents,
                    accessor.componentType,
                    accessor.normalTexture,
                    bufferView.byteStride,
                    accessor.byteOffset
                );
            }
        }

        this.glObjects.set(primitive, vao);
        return vao;
    }

    prepareMesh(mesh)
    {
        for (const primitive of mesh.primitives)
        {
            this.preparePrimitive(primitive);
        }
    }

    prepareNode(node)
    {
        if (node.mesh)
        {
            this.prepareMesh(node.mesh);
        }
        for (const child of node.children)
        {
            this.prepareNode(child);
        }
    }

    prepareScene(scene)
    {
        for (const node of scene.nodes)
        {
            this.prepareNode(node);
        }
    }

    render(scene, player, camera, sinceStart)
    {
        /** @type {WebGL2RenderingContext} */
        const gl = this.gl;
        const program = this.programs.shader;

        gl.useProgram(program.program);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(program.uniforms.uTexture, 0);

        const cameraMatrix = camera.getGlobalTransform();
        const playerMatrix = player.getGlobalTransform();

        // Set camera position to that of the player, so it always follows him
        cameraMatrix[12] = playerMatrix[12];
        cameraMatrix[13] = playerMatrix[13];
        cameraMatrix[14] = playerMatrix[14];
        // Translate Z back for viewDistance
        mat4.translate(cameraMatrix, cameraMatrix, [0, 0, camera.viewDistance]);
        
        const cameraPosition = [cameraMatrix[12], cameraMatrix[13], cameraMatrix[14]];
        const playerPosition = [playerMatrix[12], playerMatrix[13], playerMatrix[14]];
        const up = [0, 1, 0];
        const viewMatrix = mat4.lookAt(mat4.create(), cameraPosition, playerPosition, up); // look at the player

        // ANIMATIONS
        // Gets the bone positions for the current frame of animation
        const animation = player.getAnimation();
        const boneMatrices = player.armature.getBoneMatrices(animation, sinceStart);

        // Debug
        const identity = [
            1., 0., 0., 0.,
            0., 1., 0., 0.,
            0., 0., 1., 0.,
            0., 0., 0., 1.
        ];
        const nBones = boneMatrices.length / 16; // Every bone is 4x4 matrix
        let identityBones = []; // NOTE: Send this to the shader to stop animation
        for (let i = 0; i < nBones; i++)
        {
            identityBones[i] = identity;
        }
        identityBones = new Float32Array([].concat(...identityBones));

        gl.uniformMatrix4fv(program.uniforms["uBones[0]"], false, boneMatrices); // Send the bone positions to the shader
        // gl.uniformMatrix4fv(program.uniforms["uBones[0]"], false, identityBones); // Send the bone positions to the shader

        const mvpMatrix = mat4.mul(mat4.create(), camera.projection, viewMatrix);
        for (const node of scene.nodes)
        {
            this.renderNode(node, mvpMatrix);
        }

        this.timeOld = sinceStart;
    }

    renderNode(node, mvpMatrix)
    {
        const gl = this.gl;

        mvpMatrix = mat4.clone(mvpMatrix);
        mat4.mul(mvpMatrix, mvpMatrix, node.transform);

        if (node.mesh)
        {
            const program = this.programs.shader;
            gl.uniformMatrix4fv(program.uniforms.uModelViewProjection, false, mvpMatrix);
            for (const primitive of node.mesh.primitives)
            {
                this.renderPrimitive(primitive);
            }
        }
        else if (node.model)
        {
            const program = this.programs.shader;
            gl.bindVertexArray(node.model.vao);
            gl.uniformMatrix4fv(program.uniforms.uModelViewProjection, false, mvpMatrix);
            gl.bindTexture(gl.TEXTURE_2D, node.texture);
            gl.drawElements(gl.TRIANGLES, node.model.indices, gl.UNSIGNED_SHORT, 0);
        }

        for (const child of node.children)
        {
            if(child.isJoint || (child.name && child.name == "Camera"))
            {
                continue;
            }
            this.renderNode(child, mvpMatrix);
        }
    }

    renderPrimitive(primitive)
    {
        const gl = this.gl;

        const vao = this.glObjects.get(primitive);
        const material = primitive.material;
        const texture = material.baseColorTexture;
        const glTexture = this.glObjects.get(texture.image);
        const glSampler = this.glObjects.get(texture.sampler);

        gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, glTexture);
        gl.bindSampler(0, glSampler);

        if (primitive.indices)
        {
            const mode = primitive.mode;
            const count = primitive.indices.count;
            const type = primitive.indices.componentType;
            gl.drawElements(mode, count, type, 0);
        }
        else
        {
            const mode = primitive.mode;
            const count = primitive.attributes.POSITION.count;
            gl.drawArrays(mode, 0, count);
        }
    }
}