export class Engine
{
    constructor(canvas, glOptions)
    {
        this._update = this._update.bind(this);

        this.canvas = canvas;
        this._initGL(glOptions);
        this.start();

        // this._update is a callback to be executed BEFORE repaint
        requestAnimationFrame(this._update);
    }

    _initGL(glOptions)
    {
        this.gl = null;
        try
        {
            this.gl = this.canvas.getContext("webgl2", glOptions);
        }
        catch (error)
        {
            console.log("Cannot get webgl2 context from canvas.");
        }

        if (!this.gl) // Cover all cases
        {
            console.log("Cannot create webgl2 context");
        }
    }

    _update()
    {
        this._resize();
        this.update();
        this.render();
        requestAnimationFrame(this._update);
    }

    _resize()
    {
        /** @type {WebGL2RenderingContext} */
        const gl = this.gl;
        const canvas = this.canvas;

        // Check if client changed the window (canvas) size
        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight)
        {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;

            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

            this.resize();
        }
    }

    // Abstract methods
    start() { }

    update() { }

    render() { }

    resize() { }


    /** @param {WebGL2RenderingContext} gl */
    static buildPrograms(gl, shaders)
    {
        const programs = {};
        for (const program in shaders)
        {
            const vertexShader = Engine.createShader(gl, shaders[program].vertex, gl.VERTEX_SHADER);
            const fragmentShader = Engine.createShader(gl, shaders[program].fragment, gl.FRAGMENT_SHADER);

            programs[program] = Engine.createProgram(gl, [vertexShader, fragmentShader]);
        }

        return programs;
    }

    /** @param {WebGL2RenderingContext} gl */
    static createShader(gl, source, type)
    {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        const status = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (!status)
        {
            const log = gl.getShaderInfoLog(shader);
            throw new Error('Cannot compile shader\nInfo log:\n' + log);
        }
        return shader;
    }

    /** @param {WebGL2RenderingContext} gl */
    static createProgram(gl, shaders)
    {
        const program = gl.createProgram();
        for (const shader of shaders)
        {
            gl.attachShader(program, shader);
        }

        gl.linkProgram(program);
        const status = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (!status)
        {
            const log = gl.getProgramInfoLog(program);
            throw new Error('Cannot link program\nInfo log:\n' + log);
        }

        // Indexes of attributes and uniforms in the shader file
        const attributes = {};
        const numActiveAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numActiveAttributes; i++)
        {
            const info = gl.getActiveAttrib(program, i);
            attributes[info.name] = gl.getAttribLocation(program, info.name); // eg. info.name = aPosition
        }

        const uniforms = {};
        const numActiveUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numActiveUniforms; i++)
        {
            const info = gl.getActiveUniform(program, i);
            uniforms[info.name] = gl.getUniformLocation(program, info.name); // eg. info.name = uModelViewProjection
        }

        return { program, attributes, uniforms };
    }

    /** @param {WebGL2RenderingContext} gl */
    static createTexture(gl, options)
    {
        const target = options.target || gl.TEXTURE_2D;
        const iformat = options.iformat || gl.RGBA;
        const format = options.format || gl.RGBA;
        const type = options.type || gl.UNSIGNED_BYTE;
        const texture = options.texture || gl.createTexture();

        if (typeof options.unit !== 'undefined')
        {
            gl.activeTexture(gl.TEXTURE0 + options.unit);
        }

        gl.bindTexture(target, texture);

        if (options.image)
        {
            gl.texImage2D(target, 0, iformat, format, type, options.image);
        }
        else
        {
            // if options.data == null, just allocate
            gl.texImage2D(target, 0, iformat, options.width, options.height, 0, format, type, options.data);
        }

        if (options.wrapS) { gl.texParameteri(target, gl.TEXTURE_WRAP_S, options.wrapS); }
        if (options.wrapT) { gl.texParameteri(target, gl.TEXTURE_WRAP_T, options.wrapT); }
        if (options.min) { gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, options.min); }
        if (options.mag) { gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, options.mag); }
        if (options.mip) { gl.generateMipmap(target); }

        return texture;
    }

    static createBuffer(gl, options)
    {
        const target = options.target || gl.ARRAY_BUFFER;
        const hint = options.hint || gl.STATIC_DRAW;
        const buffer = options.buffer || gl.createBuffer();

        gl.bindBuffer(target, buffer);
        gl.bufferData(target, options.data, hint);

        return buffer;
    }

    static createUnitQuad(gl)
    {
        return Engine.createBuffer(gl, { data: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]) });
    }

    static createClipQuad(gl)
    {
        return Engine.createBuffer(gl, { data: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]) });
    }

    static createSampler(gl, options)
    {
        const sampler = options.sampler || gl.createSampler();

        if (options.wrapS) { gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, options.wrapS); }
        if (options.wrapT) { gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_T, options.wrapT); }
        if (options.min) { gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, options.min); }
        if (options.mag) { gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, options.mag); }

        return sampler;
    }
}