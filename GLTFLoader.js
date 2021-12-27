"use strict";

import { BufferView } from "./BufferView.js";
import { Accessor } from "./Accessor.js";
import { Sampler } from "./Sampler.js";
import { Texture } from "./Texture.js";
import { Material } from "./Material.js";
import { Primitive } from "./Primitive.js";
import { Mesh } from "./Mesh.js";
import { Scene } from "./Scene.js";
import { Node } from "./Node.js";
import { Player } from "./Player.js";
import { Armature } from "./Armature.js";

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
        const isPlayerNode = gltfSpec.name !== undefined && (gltfSpec.name == "Player" || gltfSpec.name == "Armature");
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
        if (gltfSpec.mesh !== undefined)
        {
            options.mesh = await this.loadMesh(gltfSpec.mesh);
        }
        if (isPlayerNode)
        {
            const skin = this.loadSkin(0); // Armature / Skeleton from gltf
            const armature = new Armature(skin);
            const animations = [];
            for (const animIndex in this.gltf.animations)
            {
                animations.push(await this.parseAnimation(animIndex));
            }

            options.armature = armature;
            options.animations = animations;
            options.currAnimation = "Idle"; // Default animation
        }

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

    // Armature / Skeleton
    loadSkin(index)
    {
        const skin = this.gltf.skins[index];

        if (skin === undefined || skin.length == 0)
        {
            console.log("Erorr: no skins in the gltf found.");
            return;
        }
        
        const bones = [];
        const stack = [];

        const rootBoneIndex = skin.joints[0]; // Root is always first ?
        stack.push([rootBoneIndex, null]); // [boneIndex, parentIndex]
       
        while (stack.length > 0)
        {
            const item = stack.pop();
            const bone = this.gltf.nodes[item[0]]; //Get node info for bone
            const parentIndex = item[1];

            bones.push({
                boneNum: skin.joints.indexOf(item[0]),
                name: bone.name || null,
                translation: bone.translation || [0, 0, 0],
                scale: bone.scale || [1, 1, 1],
                rotation: bone.rotation || [0, 0, 0, 1],
                matrix: bone.matrix || null,
                parent: parentIndex
            });

            //Save the the final index for this joint for children reference 
            const pIndex = bones.length - 1;

            //Add children to stack
            if (bone.children != undefined)
            {
                bone.children.forEach(childIndex => stack.push([childIndex, bones[pIndex].boneNum]));
            }
        }

        return bones.sort((a, b) => a.boneNum - b.boneNum);
    }

    //https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
    async parseAnimation(index)
    {
        /*
        - Spec supports multiple Animations, each one with a possible name.
        - Channel links samples to nodes. Each channel links what property is getting changed.
        - Samples, Input & Output points to accessors which holds key frame data.
        --- Input is the Key Frame Times
        --- Output is the key frame value change, if sample is rotation, the output is a quat.
        */

        const anim = this.gltf.animations;
        if (anim === undefined || anim.length == 0)
        {
            console.log("There is no animations in gltf");
            return null;
        }

        const animation = {};
        animation.name = (anim[index].name !== undefined) ? anim[index].name : "anim" + index;

        //Process Channels and Samples
        for (const channelPtr of anim[index].channels)
        {
            //Make sure we have a target (defined by specification)
            if (channelPtr.target.node == undefined) continue;

            //Make sure node points to a joint with a name (we had to call fixSkinData() first!)
            const nodePtr = this.gltf.nodes[channelPtr.target.node];
            if (!nodePtr.isJoint || nodePtr.name === undefined)
            {
                console.log("node is not a joint or doesn't have a name");
                continue;
            }

            //Get sample data
            const samplerPtr = anim[index].samplers[channelPtr.sampler];

            // Process animation accessor from binary file
            const times = await this.processAccessor(samplerPtr.input); // Input - time
            const values = await this.processAccessor(samplerPtr.output); // Output - value

            animation.nKeyframes = times.count; // Set number of keyframes

            let joint;
            
            if (!animation[nodePtr.name])
                joint = animation[nodePtr.name] = {};
            else
                joint = animation[nodePtr.name];

            const samples = [];
            for (let i = 0; i < times.count; i++)
            {
                const ii = i * values.compLen;
                samples.push({ t: times.data[i], v: values.data.slice(ii, ii + values.compLen) });
            }

            joint[channelPtr.target.path] = { interp: samplerPtr.interpolation, samples: samples };
        }
        return animation;
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
        // let complete = [],			//list of skeleton root nodes, prevent prcessing duplicate data that can exist in file
        const skins = this.gltf.skins;
        for (const skinIndex in skins)
        {
            //Loop through all specified joints and mark the nodes as joints (bones)
            for (const jointIndex in skins[skinIndex].joints)
            {
                const nodePtr = this.gltf.nodes[skins[skinIndex].joints[jointIndex]];
                nodePtr.isJoint = true; // Set to joint - bone
                if (nodePtr.name === undefined || nodePtr.name == "") nodePtr.name = "joint" + jointIndex; //Need name to help tie animates to joints
            }
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

    async processAccessor(index)
    {
        let a = this.gltf.accessors[index],								//Accessor Alias Ref
            bView = this.gltf.bufferViews[a.bufferView],				//bufferView Ref
            buf = await this.loadBuffer(bView.buffer),                  //Buffer Data decodes into a ArrayBuffer/DataView
            bOffset = (a.byteOffset || 0) + (bView.byteOffset || 0),	//Starting point for reading.
            bLen = 0,//a.count,//bView.byteLength,						//Byte Length for this Accessor
            TAry = null,										//Type Array Ref
            DFunc = null;										//DataView Function name

        buf.dView = new DataView(buf); // IMPORTANT!

        switch (a.componentType)
        {
            case GLTFLoader.TYPE_FLOAT: TAry = Float32Array; DFunc = "getFloat32"; break;
            case GLTFLoader.TYPE_SHORT: TAry = Int16Array; DFunc = "getInt16"; break;
            case GLTFLoader.TYPE_UNSIGNED_SHORT: TAry = Uint16Array; DFunc = "getUint16"; break;
            case GLTFLoader.TYPE_UNSIGNED_INT: TAry = Uint32Array; DFunc = "getUint32"; break;
            case GLTFLoader.TYPE_UNSIGNED_BYTE: TAry = Uint8Array; DFunc = "getUint8"; break;

            default: console.log("ERROR processAccessor", "componentType unknown", a.componentType); return null; break;
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