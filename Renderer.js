import { vec3, mat4 } from './lib/gl-matrix-module.js';
import { Engine } from "./Engine.js";
import { shaders } from "./shaders.js";

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
        gl.enable(gl.STENCIL_TEST);
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
            NORMAL: 1,
            TEXCOORD_0: 2,
            JOINTS_0: 3,
            WEIGHTS_0: 4
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

    render(scene, player, camera, light, sinceStart)
    {
        /** @type {WebGL2RenderingContext} */
        const gl = this.gl;
        const program = this.programs.shader;

        gl.useProgram(program.program);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(program.uniforms.uTexture, 0);

        const cameraMatrix = camera.getGlobalTransform();
        const playerMatrix = player.getGlobalTransform();

        // Set camera position to that of the player, so it always follows him
        cameraMatrix[12] = playerMatrix[12];
        cameraMatrix[13] = playerMatrix[13];
        cameraMatrix[14] = playerMatrix[14];
        mat4.translate(cameraMatrix, cameraMatrix, [0, 0, camera.viewDistance]); // Translate Z axis for viewDistance

        const cameraPosition = [cameraMatrix[12], cameraMatrix[13], cameraMatrix[14]];
        const playerPosition = [playerMatrix[12], playerMatrix[13] + 5, playerMatrix[14]];
        const up = [0, 1, 0];
        const viewMatrix = mat4.lookAt(mat4.create(), cameraPosition, playerPosition, up); // look at the player

        // ANIMATIONS
        // Gets the bone positions for the current frame of animation
        const boneMatrices = player.getAnimationBoneMatrices(sinceStart);
        gl.uniformMatrix4fv(program.uniforms["uBones[0]"], false, boneMatrices); // Send the bone positions to the shader

        gl.uniformMatrix4fv(program.uniforms.uProjection, false, camera.projection);

        // Lighting
        const lightVMatrix = mat4.mul(mat4.create(), viewMatrix, light.transform);
        gl.uniform1f(program.uniforms.uAmbient, light.ambient);
        gl.uniform1f(program.uniforms.uDiffuse, light.diffuse);
        gl.uniform1f(program.uniforms.uSpecular, light.specular);
        gl.uniform1f(program.uniforms.uShininess, light.shininess);
        gl.uniform3fv(program.uniforms.uLightPosition, [lightVMatrix[12], lightVMatrix[13], lightVMatrix[14]]);
        const color = vec3.clone(light.color);
        vec3.scale(color, color, 1.0 / 255.0);
        gl.uniform3fv(program.uniforms.uLightColor, color);
        gl.uniform3fv(program.uniforms.uLightAttenuation, light.attenuatuion);

        const viewModelMatrix = mat4.copy(mat4.create(), viewMatrix);
        for (const node of scene.nodes)
        {
            gl.uniform1f(program.uniforms.uUseLight, true); // Use light by default
            gl.uniform1f(program.uniforms.uDrawOutline, false); // Don't draw outline by default

            if(node.name && node.name == "Armature")
            {
                this.renderNodeWithOutline(node, viewModelMatrix);
            }
            else
            {
                if (node.name && node.name.startsWith("0.")) // Another player
                {
                    const anotherPlayerAnimation = player.getAnimation(node.currAnimation);
                    const boneMatrices = player.armature.getBoneMatricesMPlayer(node.name, anotherPlayerAnimation, sinceStart);
                    gl.uniformMatrix4fv(program.uniforms["uBones[0]"], false, boneMatrices); // Send the bone positions to the shader

                    this.renderNodeWithOutline(node, viewModelMatrix);
                }
                else
                {
                    if(node.name == "Sphere")
                    {
                        gl.uniform1f(program.uniforms.uUseLight, false); // For the skyball we don't want to use lighting
                    }
                    this.renderNode(node, viewModelMatrix);
                }
            }
        }

        this.timeOld = sinceStart;
    }

    renderNode(node, viewModelMatrix, color = null)
    {
        const gl = this.gl;

        viewModelMatrix = mat4.clone(viewModelMatrix);
        mat4.mul(viewModelMatrix, viewModelMatrix, node.transform);

        const program = this.programs.shader;

        gl.uniform4fv(program.uniforms.uColor, color ? color : [0, 0, 0, 0]); // Set node color or reset it (texture is used in that case)

        if (node.mesh)
        {
            gl.uniformMatrix4fv(program.uniforms.uViewModel, false, viewModelMatrix);
            for (const primitive of node.mesh.primitives)
            {
                this.renderPrimitive(primitive);
            }
        }
        else if (node.model)
        {
            gl.bindVertexArray(node.model.vao);
            gl.uniformMatrix4fv(program.uniforms.uViewModel, false, viewModelMatrix);
            gl.bindTexture(gl.TEXTURE_2D, node.texture);
            gl.drawElements(gl.TRIANGLES, node.model.indices, gl.UNSIGNED_SHORT, 0);
        }

        for (const child of node.children)
        {
            if (child.isJoint) continue;
            this.renderNode(child, viewModelMatrix, node.color);
        }
    }

    renderNodeWithOutline(node, viewModelMatrix)
    {
        const gl = this.gl;
        const program = this.programs.shader;

        gl.stencilFunc(
            gl.ALWAYS,    // the test
            1,            // reference value
            0xFF,         // mask
        );
        // Set it so we replace with the reference value (1)
        gl.stencilOp(
           gl.KEEP,     // what to do if the stencil test fails
           gl.KEEP,     // what to do if the depth test fails
           gl.REPLACE,  // what to do if both tests pass
        );
        this.renderNode(node, viewModelMatrix); // Draw node normally

        // Set the test that the stencil must = 0
        gl.stencilFunc(
            gl.EQUAL,     // the test
            0,            // reference value
            0xFF,         // mask
        );
        // don't change the stencil buffer on draw
        gl.stencilOp(
            gl.KEEP,     // what to do if the stencil test fails
            gl.KEEP,     // what to do if the depth test fails
            gl.KEEP,  // what to do if both tests pass
        );

        // Draw outline of node
        gl.uniform1f(program.uniforms.uDrawOutline, true);
        this.renderNode(node, viewModelMatrix);
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