import { mat4, vec3 } from './lib/gl-matrix-module.js';
import { shaders } from "./shaders.js";
import { Engine } from "./Engine.js";

export class Renderer
{
    /** @param {WebGL2RenderingContext} gl */
    constructor(gl)
    {
        this.gl = gl;
        this.programs = Engine.buildPrograms(gl, shaders);
        this.glObjects = new Map();

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

        // This is an application-scoped convention, matching the shader
        const attributeNameToIndexMap = {
            POSITION: 0,
            TEXCOORD_0: 1
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

        const mvpMatrix = mat4.mul(mat4.create(), camera.projection, viewMatrix);
        for (const node of scene.nodes)
        {
            this.renderNode(node, mvpMatrix);
        }
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