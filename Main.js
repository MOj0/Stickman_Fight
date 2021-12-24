import { Engine } from "./Engine.js";
import { mat4, vec3 } from './lib/gl-matrix-module.js';
// import { GUI } from './lib/dat.gui.module.js';
import { Node } from "./Node.js";
import * as FloorModel from "./floor.js";
import * as CubeModel from "./cube.js";
import { Renderer } from "./Renderer.js";
import { Camera } from "./Camera.js";
import { Scene } from "./Scene.js";
import { Player } from "./Player.js";
import { MPlayer } from "./server/client/player.js";
import { Ai } from "./server/client/ai.js";
import { Laser } from "./server/client/bullet.js";

import { GLTFLoader } from "./GLTFLoader.js";


let socket;
let data;
let mPlayer;
let ipAddress;
let lasers = [];
let lasersEnemy = [];
let otherPlayers = [];
let otherPlayerNodes = [];
const HIT_RANGE = 0.1;

document.addEventListener("DOMContentLoaded", () =>
{
    ipAddress = window.location.host;
    console.log("Server IP ", ipAddress)
    socket = io.connect(ipAddress + '/');

    // On 'start' message, server generates the player object and returns it as a response
    let uid = (Math.random() + 1).toString(36).substring(2);
    console.log("Player UID:", uid);
    socket.emit('start', uid, function(playerData){
        // Generating player
        mPlayer = new MPlayer(playerData.player, playerData.x, playerData.y, playerData.life,
                            playerData.maxLife, playerData.xp, playerData.level,
                            playerData.spawnID, playerData.inventory);
        console.log(playerData);
    });
    socket.on('health', function(life){
        mPlayer.life = life;
        console.log("Life from server: "+life);
    });
    socket.on('updateXP', function(xp){
        mPlayer.xp = xp;
        console.log("XP from server: "+xp);
    });
      socket.on('updateLevel', function(level){
        mPlayer.level = level;
        console.log("LEVEL from server: "+level);
    });
    
    const canvas = document.querySelector("canvas");
    const app = new App(canvas);

    socket.on('updatePosition', function(x, y){
        mPlayer.x = x;
        mPlayer.y = y;
        let tmp = app.player;
        tmp.translation = [mPlayer.x, 0, mPlayer.y];
        tmp.updateTransform();
        console.log("Position from server: "+x+" - "+y);
    });
    socket.on('broadcastRemovePlayer', function(playerName){
        // Remove any players(nodes) that left the game
        if (app.scene !== undefined) app.removeNodeByName(app.scene.nodes, playerName); 
        console.log("Removing player: "+playerName);
    });
    socket.on('heartbeat',
        function(players, lasersAll, spawnsAll, itemsAll){
        //console.log("HB", Date.now());
        for (var i = 0; i < lasersAll.length; i++) {
            lasersEnemy.push(new Laser(lasersAll[i].player, lasersAll[i].x,
            lasersAll[i].y, lasersAll[i].targetX, lasersAll[i].targetY,
            lasersAll[i].weaponType));
        }
        // Receive and generate all other players
        otherPlayers.length = 0;
        otherPlayerNodes.length = 0;
        for (var i = 0; i < players.length; i++) {
            if (mPlayer !== undefined && mPlayer.player !== players[i].player) { // 
                otherPlayers.push(new Ai(players[i].id, players[i].player, players[i].x, players[i].y, players[i].life));
            }
        }
        
        const cubeModel = app.createModel(CubeModel);
        const cubeTexture = Engine.createTexture(app.gl, {
            // options object
            data: new Uint8Array([100, 100, 255, 255]),
            width: 1,
            height: 1
        });
        // 
        for (var i = 0; i < otherPlayers.length; i++) {
            if (app.scene !== undefined) app.removeNodeByName(app.scene.nodes, otherPlayers[i].player);
            let tmp = new Node({
                model:  cubeModel,
                texture:  cubeTexture
            });
            tmp.name = otherPlayers[i].player;
            if (app.scene !== undefined) app.scene.addNode(tmp);
        }       

        if (app.scene !== undefined) {
            for (let i in otherPlayers) {
                //console.log(otherPlayers[i].player);
                let tmp = app.getNodeByName(app.scene.nodes, otherPlayers[i].player);
                if (tmp !== undefined) {
                    tmp.translation = [otherPlayers[i].x, 0, otherPlayers[i].y];
                    tmp.updateTransform();
                    // console.log([mPlayer.x, 0, mPlayer.y]);
                }
            }
        }
        
    });
    // const gui = new GUI();

    // gui.add(app.camera, 'mouseSensitivity', 0.0001, 0.01);
    // gui.add(app.cube, 'maxSpeed', 0, 10);
    // gui.add(app.cube, 'friction', 0.05, 0.75);
    // gui.add(app.cube, 'acceleration', 1, 100);
});


class App extends Engine
{
    async start()
    {
        /** @type {WebGL2RenderingContext} */
        const gl = this.gl;

        this.loader = new GLTFLoader();
        // await this.loader.load("./assets/models/simpleStickman/simpleStickman.gltf"); // also sets defaultScene reference
        await this.loader.load("./assets/models/stickman/stickman.gltf");
        //await this.loader.load("./assets/models/character/character.gltf");
        //await this.loader.load("./assets/models/RiggedSimple.gltf");


        // let m = this.loader.parseMesh(0);

        let animations = this.loader.parseAnimation(1);
        console.log("Loaded animation: ", animations);

        this.pointerlockchangeHandler = this.pointerlockchangeHandler.bind(this);
        this.mousedownHandler = this.mousedownHandler.bind(this);
        document.addEventListener('pointerlockchange', this.pointerlockchangeHandler);
        document.addEventListener('mousedown', this.mousedownHandler);

        this.time = Date.now();
        this.startTime = this.time;
        this.viewDistance = 3;

        const floorModel = this.createModel(FloorModel);
        const greenTexture = Engine.createTexture(gl, {
            // options object
            data: new Uint8Array([0, 255, 0, 255]),
            width: 1,
            height: 1
        });

        this.floor = new Node({
            model:  floorModel,
            texture:  greenTexture
        });
        mat4.fromScaling(this.floor.transform, [10, 1, 10]);

        const cubeModel = this.createModel(CubeModel);
        const cubeTexture = Engine.createTexture(gl, {
            // options object
            data: new Uint8Array([100, 255, 255, 255]),
            width: 1,
            height: 1
        });
        this.cube = new Node({
            model:  cubeModel,
            texture:  cubeTexture
        });
        this.cube.name = "Aim";
        

        // this.player = await this.loader.loadNode("Character");
        // mat4.fromTranslation(this.player.transform, [0, 1, -5]); // doesn't do anything?
        // this.player.updateTransform();

        this.scene = await this.loader.loadScene(this.loader.defaultScene);
        // this.scene = new Scene(); // create Scene manually

        this.scene.addNode(this.floor);
        this.scene.addNode(this.cube);

        console.log(this.scene);

        this.player = this.getNodeByName(this.scene.nodes, "Armature"); // Find Player node in scene.nodes
        this.player.animations = animations;
        this.player.translation = [mPlayer.x, 0, mPlayer.y]; // Sets player location to the one received from server
        
        this.camera = new Camera(); // create Camera manually
        this.player.addChild(this.camera);

        this.renderer = new Renderer(gl);
        this.renderer.prepareScene(this.scene);
    }

    update()
    {
        this.time = Date.now();
        const dt = (this.time - this.startTime) * 0.001;
        this.startTime = this.time;
        if (mPlayer !== undefined && this.player !== undefined) {
            mPlayer.x = this.player.translation[0];
            mPlayer.y = this.player.translation[2];

            mPlayer.mouseX = mPlayer.x - Math.sin(this.camera.rotation[1]);
            mPlayer.mouseY = mPlayer.y - Math.cos(this.camera.rotation[1]);
           
            let tmp = this.getNodeByName(this.scene.nodes, "Aim");
            for (var i = 0; i < lasers.length; i++) {
                lasers[i].move();
                tmp.translation = [lasers[i].x, 1, lasers[i].y];
                tmp.updateTransform();
                if (HIT_RANGE > Math.abs(lasers[i].x - lasers[i].targetX) + Math.abs(lasers[i].y - lasers[i].targetY)) {
                    lasers.splice(i, 1);
                }
            }
            mPlayer.health(lasersEnemy);
            // Enemy lasers show/move/limit/remove
            for (var i = 0; i < lasersEnemy.length; i++) {
                lasersEnemy[i].move();
                if (HIT_RANGE > Math.abs(lasersEnemy[i].x - lasersEnemy[i].targetX) + Math.abs(lasersEnemy[i].y - lasersEnemy[i].targetY)) {
                    lasersEnemy.splice(i, 1);
                }
            }
            // console.log(lasersEnemy, lasers);
            // console.log(mPlayer.x, mPlayer.y);
            socket.emit('update', mPlayer, lasers); // Send update message to server
        }

        if (this.camera)
        {
            this.camera.update(dt);
        }

        if (this.physics)
        {
            this.physics.update(dt);
        }
    }

    render()
    {
        if (this.renderer && this.camera)
        {
            this.renderer.render(this.scene, this.camera);
        }
    }

    resize()
    {
        if (this.camera)
        {
            const w = this.canvas.clientWidth;
            const h = this.canvas.clientHeight;
            const aspect = w / h;
            const FOVy = Math.PI / 2;
            const near = 0.1;
            const far = 100;

            mat4.perspective(this.camera.projection, FOVy, aspect, near, far);
        }
    }

    getNodeByName(nodes, name)
    {
        for(const node of nodes)
        {
            if(node.name && node.name == name)
            {
                return node;
            }
        }
    }

    removeNodeByName(nodes, name)
    {
        for(let i in nodes)
        {
            if(nodes[i].name && nodes[i].name == name)
            {
                nodes.splice(i, 1);
            }
        }
    }

    createModel(model)
    {
        /** @type {WebGL2RenderingContext} */
        const gl = this.gl;

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, model.vertices, gl.STATIC_DRAW);

        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indices, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);

        gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 16);

        const numTriangles = model.indices.length;
        return { vao, indices: numTriangles };
    }

    pointerlockchangeHandler()
    {
        if (document.pointerLockElement === this.canvas && this.camera)
        {
            this.camera.enable();
        }
        else
        {
            this.camera.disable();
        }
    }

    mousedownHandler(e)
    {
        this.canvas.requestPointerLock();
        if (e.which === 1) {
            console.log("Left click...");
            mPlayer.shoot(socket, lasers);
        } else if (e.which === 3) {
            console.log("Right click...");
        }
    }
}