"use strict";

import { BufferView } from "./BufferView.js";
import { Accessor } from "./Accessor.js";
import { Sampler } from "./Sampler.js";
import { Texture } from "./Texture.js";
import { Material } from "./Material.js";
import { Primitive } from "./Primitive.js";
import { Mesh } from "./Mesh.js";
// import { PerspectiveCamera } from "./PerspectiveCamera.js";
// import { OrthographicCamera } from "./OrthographicCamera.js";
import { Scene } from "./Scene.js";
import { Node } from "./Node.js";
import { Player } from "./Player.js";

// This class loads all GLTF resources and instantiates
// the corresponding classes. Resources are loaded sequentially.

export class GLTFLoader
{
    constructor()
    {
        this.gltf = null;
        this.gltfUrl = null;
        this.dirname = null;

        this.cache = new Map();
    }

    fetchJson(url)
    {
        return fetch(url).then(response => response.json());
    }

    fetchBuffer(url)
    {
        return fetch(url).then(response => response.arrayBuffer());
    }

    fetchImage(url)
    {
        return new Promise((resolve, reject) =>
        {
            let image = new Image();
            image.addEventListener("load", e => resolve(image));
            image.addEventListener("error", reject);
            image.src = url;
        });
    }

    findByNameOrIndex(set, nameOrIndex)
    {
        if (typeof nameOrIndex === "number")
        {
            return set[nameOrIndex];
        }
        return set.find(element => element.name === nameOrIndex);
    }

    async load(url)
    {
        this.gltfUrl = new URL(url, window.location);
        this.gltf = await this.fetchJson(url);
        this.defaultScene = this.gltf.scene || 0; // Reference to the scene object
        if (this.gltf.skins) this.fixSkinData(); // Fixes unnamed joints, etc.
        console.log("Loaded gltf: ", this.gltf);
    }

    async loadImage(nameOrIndex)
    {
        const gltfSpec = this.findByNameOrIndex(this.gltf.images, nameOrIndex);
        if (this.cache.has(gltfSpec))
        {
            return this.cache.get(gltfSpec);
        }

        if (gltfSpec.uri)
        {
            const url = new URL(gltfSpec.uri, this.gltfUrl);
            const image = await this.fetchImage(url);
            this.cache.set(gltfSpec, image);
            return image;
        }

        const bufferView = await this.loadBufferView(gltfSpec.bufferView);
        const blob = new Blob([bufferView], { type: gltfSpec.mimeType });
        const url = URL.createObjectURL(blob);
        const image = await this.fetchImage(url);
        URL.revokeObjectURL(url);
        this.cache.set(gltfSpec, image);
        return image;
    }

    async loadBuffer(nameOrIndex)
    {
        const gltfSpec = this.findByNameOrIndex(this.gltf.buffers, nameOrIndex);
        if (this.cache.has(gltfSpec))
        {
            return this.cache.get(gltfSpec);
        }

        const url = new URL(gltfSpec.uri, this.gltfUrl);
        const buffer = await this.fetchBuffer(url);
        this.cache.set(gltfSpec, buffer);
        return buffer;
    }

    async loadBufferView(nameOrIndex)
    {
        const gltfSpec = this.findByNameOrIndex(this.gltf.bufferViews, nameOrIndex);
        if (this.cache.has(gltfSpec))
        {
            return this.cache.get(gltfSpec);
        }

        // object containing buffer, stride, offset...
        const bufferView = new BufferView({
            ...gltfSpec,
            buffer: await this.loadBuffer(gltfSpec.buffer)
        });
        this.cache.set(gltfSpec, bufferView);
        return bufferView;
    }

    async loadAccessor(nameOrIndex)
    {
        const gltfSpec = this.findByNameOrIndex(this.gltf.accessors, nameOrIndex);
        if (this.cache.has(gltfSpec))
        {
            return this.cache.get(gltfSpec);
        }

        const accessorTypeToNumComponentsMap = {
            SCALAR: 1,
            VEC2: 2,
            VEC3: 3,
            VEC4: 4,
            MAT2: 4,
            MAT3: 9,
            MAT4: 16,
        };

        const accessor = new Accessor({
            ...gltfSpec,
            bufferView: await this.loadBufferView(gltfSpec.bufferView),
            numComponents: accessorTypeToNumComponentsMap[gltfSpec.type]
        });
        this.cache.set(gltfSpec, accessor);
        return accessor;
    }

    async loadSampler(nameOrIndex)
    {
        const gltfSpec = this.findByNameOrIndex(this.gltf.samplers, nameOrIndex);
        if (this.cache.has(gltfSpec))
        {
            return this.cache.get(gltfSpec);
        }

        const sampler = new Sampler({
            min: gltfSpec.minFilter,
            mag: gltfSpec.magFilter,
            wrapS: gltfSpec.wrapS,
            wrapT: gltfSpec.wrapT
        });
        this.cache.set(gltfSpec, sampler);
        return sampler;
    }

    async loadTexture(nameOrIndex)
    {
        const gltfSpec = this.findByNameOrIndex(this.gltf.textures, nameOrIndex);
        if (this.cache.has(gltfSpec))
        {
            return this.cache.get(gltfSpec);
        }

        let options = {};
        if (gltfSpec.source !== undefined)
        {
            options.image = await this.loadImage(gltfSpec.source);
        }
        if (gltfSpec.sampler !== undefined)
        {
            options.sampler = await this.loadSampler(gltfSpec.sampler);
        }

        const texture = new Texture(options);
        this.cache.set(gltfSpec, texture);
        return texture;
    }

    async loadMaterial(nameOrIndex)
    {
        const gltfSpec = this.findByNameOrIndex(this.gltf.materials, nameOrIndex);
        if (this.cache.has(gltfSpec))
        {
            return this.cache.get(gltfSpec);
        }

        let options = {};
        const pbr = gltfSpec.pbrMetallicRoughness;
        if (pbr !== undefined)
        {
            if (pbr.baseColorTexture !== undefined)
            {
                options.baseColorTexture = await this.loadTexture(pbr.baseColorTexture.index);
                options.baseColorTexCoord = pbr.baseColorTexture.texCoord;
            }
            if (pbr.metallicRoughnessTexture !== undefined)
            {
                options.metallicRoughnessTexture = await this.loadTexture(pbr.metallicRoughnessTexture.index);
                options.metallicRoughnessTexCoord = pbr.metallicRoughnessTexture.texCoord;
            }
            options.baseColorFactor = pbr.baseColorFactor;
            options.metallicFactor = pbr.metallicFactor;
            options.roughnessFactor = pbr.roughnessFactor;
        }

        if (gltfSpec.normalTexture !== undefined)
        {
            options.normalTexture = await this.loadTexture(gltfSpec.normalTexture.index);
            options.normalTexCoord = gltfSpec.normalTexture.texCoord;
            options.normalFactor = gltfSpec.normalTexture.scale;
        }

        if (gltfSpec.occlusionTexture !== undefined)
        {
            options.occlusionTexture = await this.loadTexture(gltfSpec.occlusionTexture.index);
            options.occlusionTexCoord = gltfSpec.occlusionTexture.texCoord;
            options.occlusionFactor = gltfSpec.occlusionTexture.strength;
        }

        if (gltfSpec.emissiveTexture !== undefined)
        {
            options.emissiveTexture = await this.loadTexture(gltfSpec.emissiveTexture.index);
            options.emissiveTexCoord = gltfSpec.emissiveTexture.texCoord;
            options.emissiveFactor = gltfSpec.emissiveFactor;
        }

        options.alphaMode = gltfSpec.alphaMode;
        options.alphaCutoff = gltfSpec.alphaCutoff;
        options.doubleSided = gltfSpec.doubleSided;

        const material = new Material(options);
        this.cache.set(gltfSpec, material);
        return material;
    }

    async loadMesh(nameOrIndex)
    {
        const gltfSpec = this.findByNameOrIndex(this.gltf.meshes, nameOrIndex);
        if (this.cache.has(gltfSpec))
        {
            return this.cache.get(gltfSpec);
        }

        let options = { primitives: [] };
        for (const primitiveSpec of gltfSpec.primitives)
        {
            let primitiveOptions = {};
            primitiveOptions.attributes = {};
            for (const name in primitiveSpec.attributes)
            {
                primitiveOptions.attributes[name] = await this.loadAccessor(primitiveSpec.attributes[name]);
            }
            if (primitiveSpec.indices !== undefined)
            {
                primitiveOptions.indices = await this.loadAccessor(primitiveSpec.indices);
            }
            if (primitiveSpec.material !== undefined)
            {
                primitiveOptions.material = await this.loadMaterial(primitiveSpec.material);
            }
            primitiveOptions.mode = primitiveSpec.mode;
            const primitive = new Primitive(primitiveOptions);
            options.primitives.push(primitive);
        }

        const mesh = new Mesh(options);
        this.cache.set(gltfSpec, mesh);
        return mesh;
    }

    async loadCamera(nameOrIndex)
    {
        const gltfSpec = this.findByNameOrIndex(this.gltf.cameras, nameOrIndex);
        if (this.cache.has(gltfSpec))
        {
            return this.cache.get(gltfSpec);
        }
        if (gltfSpec.type === 'perspective')
        {
            const persp = gltfSpec.perspective;
            const camera = new PerspectiveCamera({
                aspect: persp.aspectRatio,
                fov: persp.yfov,
                near: persp.znear,
                far: persp.zfar,
            });
            this.cache.set(gltfSpec, camera);
            return camera;
        } else if (gltfSpec.type === 'orthographic')
        {
            const ortho = gltfSpec.orthographic;
            const camera = new OrthographicCamera({
                left: -ortho.xmag,
                right: ortho.xmag,
                bottom: -ortho.ymag,
                top: ortho.ymag,
                near: ortho.znear,
                far: ortho.zfar,
            });
            this.cache.set(gltfSpec, camera);
            return camera;
        }
    }

    async loadNode(nameOrIndex)
    {
        const gltfSpec = this.findByNameOrIndex(this.gltf.nodes, nameOrIndex);
        if (this.cache.has(gltfSpec))
        {
            return this.cache.get(gltfSpec);
        }
        let options = { ...gltfSpec, children: [] };
        if (gltfSpec.children)
        {
            for (const nodeIndex of gltfSpec.children)
            {
                const node = await this.loadNode(nodeIndex);
                options.children.push(node);
            }
        }
        // if (gltfSpec.camera !== undefined)
        // {
        // options.camera = await this.loadCamera(gltfSpec.camera);
        // }
        if (gltfSpec.mesh !== undefined)
        {
            options.mesh = await this.loadMesh(gltfSpec.mesh);
        }

        const isPlayerNode = gltfSpec.name !== undefined && (gltfSpec.name == "Player" || gltfSpec.name == "Armature");
        const node = isPlayerNode ? new Player(options) : new Node(options);
        this.cache.set(gltfSpec, node);
        return node;
    }

    async loadScene(nameOrIndex)
    {
        const gltfSpec = this.findByNameOrIndex(this.gltf.scenes, nameOrIndex);
        if (this.cache.has(gltfSpec))
        {
            return this.cache.get(gltfSpec);
        }

        let options = { nodes: [] };
        if (gltfSpec.nodes)
        {
            for (const nodeIndex of gltfSpec.nodes)
            {
                const node = await this.loadNode(nodeIndex);
                options.nodes.push(node);
            }
        }

        const scene = new Scene(options);
        this.cache.set(gltfSpec, scene);
        return scene;
    }

    parseMesh(idx)
    {
        var m = this.gltf.meshes[idx];
        var meshName = m.name || "unnamed";
        //m.weights = for morph targets
        //m.name

        //p.attributes.TANGENT = vec4
        //p.attributes.TEXCOORD_1 = vec2
        //p.attributes.COLOR_0 = vec3 or vec4
        //p.material
        //p.targets = Morph Targets
        //console.log("Parse Mesh",meshName);
        //.....................................
        var p,			//Alias for prmitive element
            a,			//Alias for prmitive's attributes
            itm,
            mesh = [];

        for (var i = 0; i < m.primitives.length; i++)
        {
            p = m.primitives[i];
            a = p.attributes;

            itm = {
                name: meshName + "_p" + i,
                mode: (p.mode != undefined) ? p.mode : GLTFLoader.MODE_TRIANGLES,
                indices: null,	//p.indices
                vertices: null,	//p.attributes.POSITION = vec3
                normals: null,	//p.attributes.NORMAL = vec3
                texcoord: null,	//p.attributes.TEXCOORD_0 = vec2
                joints: null,	//p.attributes.JOINTS_0 = vec4
                weights: null,	//p.attributes.WEIGHTS_0 = vec4
                armature: null
            };

            //Get Raw Data
            itm.vertices = this.loadAccessor(a.POSITION);
            if (p.indices != undefined) itm.indices = this.loadAccessor(p.indices);
            if (a.NORMAL != undefined) itm.normals = this.loadAccessor(a.NORMAL);
            if (a.WEIGHTS_0 != undefined) itm.weights = this.loadAccessor(a.WEIGHTS_0);
            if (a.JOINTS_0 != undefined) itm.joints = this.loadAccessor(a.JOINTS_0);

            //NOTE : Spec pretty much states that a mesh CAN be made of up multiple objects, but each
            //object in reality is just a mesh with its own vertices and attributes. So each PRIMITIVE
            //is just a single draw call. For fungi I'm not going to build objects like this when
            //I export from mesh, so the first primitive in the mesh is enough for me.

            //May change the approach down the line if there is a need to have a single mesh
            //to be made up of sub meshes.

            if (m.fSkinIdx !== undefined) itm.armature = this.parseSkin(m.fSkinIdx);

            return itm;
        }
    }

    //Armature / Skeleton
    parseSkin(idx)
    {
        //Check if the skin has already processed skeleton info
        var i, s = this.gltf.skins[idx]; //skin reference

        //skeleton not processed, do it now.
        var stack = [],	//Queue
            final = [],	//Flat array of joints for skeleton
            n,			//Node reference 
            itm,		//popped queue item
            pIdx;		//parent index
        console.log("--->", s);
        if (s.joints.indexOf(s.skeleton) != -1) stack.push([s.skeleton, null]); //Add Root bone Node Index, final index ofParent	
        else
        {
            var cAry = this.gltf.nodes[s.skeleton].children;
            for (var c = 0; c < cAry.length; c++) stack.push([cAry[c], null]);
        }


        while (stack.length > 0)
        {
            itm = stack.pop();				//Pop off the list
            n = this.gltf.nodes[itm[0]];	//Get node info for joint

            if (n.isJoint != true) continue; //Check preprocessing to make sure its actually a used node.

            //Save copy of data : Ques? Are bones's joint number always in a linear fashion where parents have
            //a lower index then the children;
            final.push({
                jointNum: s.joints.indexOf(itm[0]),
                name: n.name || null,
                position: n.translation || null,
                scale: n.scale || null,
                rotation: n.rotation || null,
                matrix: n.matrix || null,
                parent: itm[1],
                nodeIdx: itm[0]
            });

            //Save the the final index for this joint for children reference 
            pIdx = final.length - 1;

            //Add children to stack
            if (n.children != undefined)
            {
                for (i = 0; i < n.children.length; i++) stack.push([n.children[i], pIdx]);
            }
        }

        //final.nodeIdx = s.skeleton; //Save root node index to make sure we dont process the same skeleton twice.
        return final;
    }


    //https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
    async parseAnimation(idx)
    {
        /*
        NOTES: When Node isn't defined, ignore
        interpolation values include LINEAR, STEP, CATMULLROMSPLINE, and CUBICSPLINE.

        - Spec supports multiple Animations, each one with a possible name.
        - Channel links samples to nodes. Each channel links what property is getting changed.
        - Samples, Input & Output points to accessors which holds key frame data.
        --- Input is the Key Frame Times
        --- Output is the key frame value change, if sample is rotation, the output is a quat.

        "animations": [
            {	"name": "Animation1",
                "channels": [
                { "sampler": 0, "target": { "node": 2, "path": "translation" } },
                { "sampler": 1, "target": { "node": 2, "path": "rotation" } },
                { "sampler": 2, "target": { "node": 2, "path": "scale" } }
            ],

            "samplers": [
                { "input": 5, "interpolation": "LINEAR", "output": 6 },
                { "input": 5, "interpolation": "LINEAR", "output": 7 },
                { "input": 5, "interpolation": "LINEAR", "output": 8 }
            ]
        },
        */
        //............................

        var anim = this.gltf.animations;
        if (anim === undefined || anim.length == 0) { console.log("There is no animations in gltf"); return null; }

        var rtn = {},
            i, ii,
            joint,
            nPtr, //node ptr
            sPtr, //sample ptr
            chPtr; //channel ptr

        //Save the name
        rtn.name = (anim[idx].name !== undefined) ? anim[idx].name : "anim" + idx;

        //Process Channels and Samples.
        for (var ich = 0; ich < anim[idx].channels.length; ich++)
        {
            //.......................
            //Make sure we have a target
            chPtr = anim[idx].channels[ich];
            if (chPtr.target.node == undefined) continue;

            //.......................
            //Make sure node points to a joint with a name.
            nPtr = this.gltf.nodes[chPtr.target.node];
            if (!nPtr.isJoint || nPtr.name === undefined)
            {
                console.log("node is not a joint or doesn't have a name");
                continue;
            }

            //.......................
            //Get sample data
            sPtr = anim[idx].samplers[chPtr.sampler];
            const tData = await this.loadAccessor(sPtr.input); //Get Time for all keyframes
            const vData = await this.loadAccessor(sPtr.output); //Get Value that changes per keyframe

            console.log("tData", tData);
            console.log("vData", vData);

            const tDataValues = new Float32Array(tData.bufferView.buffer);
            console.log("tData data: ", tDataValues);
            const vDataValues = new Float32Array(vData.bufferView.buffer);
            console.log("vData data: ", vDataValues);

            //.......................
            if (!rtn[nPtr.name])
                joint = rtn[nPtr.name] = {};
            else
                joint = rtn[nPtr.name];

            var samples = [];
            joint[chPtr.target.path] = { interp: sPtr.interpolation, samples: samples };

            for (i = 0; i < tData.count; i++)
            {
                ii = i * vData.numComponents;
                samples.push({ t: tDataValues[i], v: tDataValues.slice(ii, ii + vData.numComponents) }); // We got samples yay!
            }
        }
        return rtn;
    }


    //++++++++++++++++++++++++++++++++++++++
    // Fix up issues with the data / spec to make it easier to parse data as single assets.
    //++++++++++++++++++++++++++++++++++++++
    //Go through Skins and make all nodes as joints for later processing.
    //Joint data never exports well, there is usually garbage. Documentation
    //Suggests that developer pre process nodes to make them as joints and
    //it does help weed out bad data
    fixSkinData()
    {
        var complete = [],			//list of skeleton root nodes, prevent prcessing duplicate data that can exist in file
            s = this.gltf.skins,	//alias for skins
            j,						//loop index
            n;						//Node Ref

        for (var i = 0; i < s.length; i++)
        {
            if (complete.indexOf(s[i].skeleton) != -1) continue; //If already processed, go to next skin

            //Loop through all specified joints and mark the nodes as joints.
            for (j in s[i].joints)
            {
                n = this.gltf.nodes[s[i].joints[j]];
                n.isJoint = true;
                if (n.name === undefined || n.name == "") n.name = "joint" + j; //Need name to help tie animates to joints
            }

            complete.push(s[i].skeleton); //push root node index to complete list.
        }

        this.linkSkinToMesh(); //Since we have skin data, Link Mesh to skin for easy parsing.
    }

    //Skin is only reference to a mesh through a scene node (dont like this)
    //So interate threw all the nodes looking for those links, then save the
    linkSkinToMesh()
    {
        var rNodes = this.gltf.scenes[0].nodes,
            nStack = [],
            node,
            idx,
            i;

        //Setup Initial Stack
        for (i = 0; i < rNodes.length; i++) nStack.push(rNodes[i]);

        //Process Stack of nodes, check for children to add to stack
        while (nStack.length > 0)
        {
            idx = nStack.pop();
            node = this.gltf.nodes[idx];

            //Create a new property on the mesh object that has the skin index.
            if (node.mesh != undefined && node.skin != undefined)
                this.gltf.meshes[node.mesh]["fSkinIdx"] = node.skin;

            //Add More Nodes to the stack
            if (node.children != undefined)
                for (i = 0; i < node.children.length; i++) nStack.push(node.children[i]);
        }
    }


    //++++++++++++++++++++++++++++++++++++++
    // Helper functions to help parse vertex data / attributes.
    //++++++++++++++++++++++++++++++++++++++
    //Decodes the binary buffer data into a Type Array that is webgl friendly.
    processAccessor(idx)
    {
        var a = this.gltf.accessors[idx],								//Accessor Alias Ref
            bView = this.gltf.bufferViews[a.bufferView],				//bufferView Ref

            buf = this.prepareBuffer(bView.buffer),					//Buffer Data decodes into a ArrayBuffer/DataView
            bOffset = (a.byteOffset || 0) + (bView.byteOffset || 0),	//Starting point for reading.
            bLen = 0,//a.count,//bView.byteLength,									//Byte Length for this Accessor

            TAry = null,												//Type Array Ref
            DFunc = null;												//DateView Function name

        //Figure out which Type Array we need to save the data in
        switch (a.componentType)
        {
            case GLTFLoader.TYPE_FLOAT: TAry = Float32Array; DFunc = "getFloat32"; break;
            case GLTFLoader.TYPE_SHORT: TAry = Int16Array; DFunc = "getInt16"; break;
            case GLTFLoader.TYPE_UNSIGNED_SHORT: TAry = Uint16Array; DFunc = "getUint16"; break;
            case GLTFLoader.TYPE_UNSIGNED_INT: TAry = Uint32Array; DFunc = "getUint32"; break;
            case GLTFLoader.TYPE_UNSIGNED_BYTE: TAry = Uint8Array; DFunc = "getUint8"; break;

            default: console.log("ERROR processAccessor", "componentType unknown", a.componentType); return null;
        }

        //When more then one accessor shares a buffer, The BufferView length is the whole section
        //but that won't work, so you need to calc the partition size of that whole chunk of data
        //The math in the spec about stride doesn't seem to work, it goes over bounds, what Im using works.
        //https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#data-alignment
        if (bView.byteStride != undefined) bLen = bView.byteStride * a.count;
        else bLen = a.count * GLTFLoader["COMP_" + a.type] * TAry.BYTES_PER_ELEMENT; //elmCnt * compCnt * compByteSize)

        //Pull the data out of the dataView based on the Type.
        var bPer = TAry.BYTES_PER_ELEMENT,	//How many Bytes needed to make a single element
            aLen = bLen / bPer,				//Final Array Length
            ary = new TAry(aLen),			//Final Array
            p = 0;						//Starting position in DataView

        for (var i = 0; i < aLen; i++)
        {
            p = bOffset + i * bPer;
            ary[i] = buf.dView[DFunc](p, true);
        }

        //console.log(a.type,GLTFLoader["COMP_"+a.type],"offset",bOffset, "bLen",bLen, "aLen", aLen, ary);
        return { data: ary, max: a.max, min: a.min, count: a.count, compLen: GLTFLoader["COMP_" + a.type] };
    }

    //Get the buffer data ready to be parsed threw by the Accessor
    prepareBuffer(idx)
    {
        var buf = this.gltf.buffers[idx];

        if (buf.dView != undefined) return buf;

        // if (buf.uri.substr(0, 5) != "data:")
        // {
        //     //TODO Get Bin File
        //     return buf;
        // }

        console.log("buf uri", buf.uri);
        console.log(window.atob(buf.uri));
        //Create and Fill DataView with buffer data
        var pos = buf.uri.indexOf("base64,") + 7,
            blob = window.atob(buf.uri),
            dv = new DataView(new ArrayBuffer(blob.length));
        for (var i = 0; i < blob.length; i++) dv.setUint8(i, blob.charCodeAt(i));
        buf.dView = dv;

        //console.log("buffer len",buf.byteLength,dv.byteLength);
        //var fAry = new Float32Array(blob.length/4);
        //for(var j=0; j < fAry.length; j++) fAry[j] = dv.getFloat32(j*4,true);
        //console.log(fAry);
        return buf;
    }
}

//------------------------------------------------------------
// CONSTANTS
//------------------------------------------------------------
GLTFLoader.MODE_POINTS = 0;	//Mode Constants for GLTF and WebGL are identical
GLTFLoader.MODE_LINES = 1;	//https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants
GLTFLoader.MODE_LINE_LOOP = 2;
GLTFLoader.MODE_LINE_STRIP = 3;
GLTFLoader.MODE_TRIANGLES = 4;
GLTFLoader.MODE_TRIANGLE_STRIP = 5;
GLTFLoader.MODE_TRIANGLE_FAN = 6;

GLTFLoader.TYPE_BYTE = 5120;
GLTFLoader.TYPE_UNSIGNED_BYTE = 5121;
GLTFLoader.TYPE_SHORT = 5122;
GLTFLoader.TYPE_UNSIGNED_SHORT = 5123;
GLTFLoader.TYPE_UNSIGNED_INT = 5125;
GLTFLoader.TYPE_FLOAT = 5126;

GLTFLoader.COMP_SCALAR = 1;
GLTFLoader.COMP_VEC2 = 2;
GLTFLoader.COMP_VEC3 = 3;
GLTFLoader.COMP_VEC4 = 4;
GLTFLoader.COMP_MAT2 = 4;
GLTFLoader.COMP_MAT3 = 9;
GLTFLoader.COMP_MAT4 = 16;