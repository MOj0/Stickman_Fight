"use strict";

import { mat4 } from './lib/gl-matrix-module.js';
import { Engine } from './Engine.js';
import { Node } from './Node.js';
import * as FloorModel from "./floor.js";
import { PerspectiveCamera } from './PerspectiveCamera.js';
import * as CubeModel from "./cube.js";
import { Renderer } from "./Renderer.js";
import { MPlayer } from "./server/client/player.js";
import { OtherPlayer } from "./server/client/OtherPlayers.js";
import { Hit } from "./server/client/Hit.js";
import { GLTFLoader } from "./GLTFLoader.js";


let socket;
let mPlayer;
let ipAddress;
let hits = [];
let hitsEnemy = [];
let updateGUI = true;
let otherPlayers = [];
let otherPlayerNodes = [];
const HIT_RANGE = 0.3;

function mapNumber(num, in_min, in_max, out_min, out_max){
    return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

document.addEventListener("DOMContentLoaded", () =>
{
    ipAddress = window.location.host;
    console.log("Server IP ", ipAddress)
    socket = io.connect(ipAddress + '/');
    $("#overlay").hide();

    // On 'start' message, server generates the player object and returns it as a response
    let uid = (Math.random() + 1).toString(36).substring(2);
    console.log("Player UID:", uid);
    socket.emit('start', uid, function(playerData){
        // Generating player
        mPlayer = new MPlayer(playerData.player, playerData.x, playerData.y, playerData.life,
                            playerData.maxLife, playerData.xp, playerData.level,
                            playerData.spawnID, playerData.inventory);
        mPlayer.hitWithDelay = (hitType, delay) => {
            if (!mPlayer.hitTimeout) {
                setTimeout(() => {
                    mPlayer.shoot(socket, hits, hitType);
                }, delay);
                mPlayer.hitTimeout = true;
            }
        };
        console.log(mPlayer);

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
        $("#overlay").hide()
    });
    socket.on('broadcastRemovePlayer', function(playerName){
        // Remove any players(nodes) that left the game
        if (app.scene !== undefined) app.removeNodeByName(app.scene.nodes, playerName); 
        console.log("Removing player: "+playerName);
    });
    socket.on('heartbeat',
        function(players, hitsAll, spawnsAll, itemsAll){
        for (var i = 0; i < hitsAll.length; i++) {
            hitsEnemy.push(new Hit(hitsAll[i].player, hitsAll[i].x,
            hitsAll[i].y, hitsAll[i].targetX, hitsAll[i].targetY,
            hitsAll[i].weaponType));
        }
        // Receive and generate all other players
        otherPlayers.length = 0;
        otherPlayerNodes.length = 0;
        for (var i = 0; i < players.length; i++) {
            if (mPlayer !== undefined && mPlayer.player !== players[i].player) { // 
                otherPlayers.push(new OtherPlayer(players[i].id, players[i].player, players[i].x, players[i].y, players[i].life));
            }
        }
        
        const cubeModel = app.createModel(CubeModel);
        const cubeTexture = Engine.createTexture(app.gl, {
            // options object
            data: new Uint8Array([100, 100, 255, 255]),
            width: 1,
            height: 1
        });
 
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
                let tmp = app.scene.getNodeByName(otherPlayers[i].player);
                if (tmp !== undefined) {
                    tmp.translation = [otherPlayers[i].x, 0, otherPlayers[i].y];
                    tmp.updateTransform();
                }
            }
        }
        
        if (mPlayer && updateGUI) {
            mPlayer.xpForNextLevel = 200 + 75 * (mPlayer.level-1);
            let totalXP = 37.5*(mPlayer.level * mPlayer.level) + 87.5*mPlayer.level - 125;
            // Calculates percente to get to new level
            let percent = 100 / mPlayer.xpForNextLevel * (mPlayer.xp-totalXP);
            if (percent <= 25) {
                $("#xp0").css("height", mapNumber(percent, 0, 25, 0, 100) + "%");
                $("#xp1").css("width","0%");
                $("#xp2").css("height","0%");
                $("#xp3").css("width","0%");
            } else if (percent <= 50) {
                $("#xp0").css("height","100%");
                $("#xp1").css("width", mapNumber(percent, 26, 50, 0, 100) + "%");
                $("#xp2").css("height","0%");
                $("#xp3").css("width","0%");
            } else if (percent <= 75) {
                $("#xp0").css("height","100%");
                $("#xp1").css("width", "100%");
                $("#xp2").css("height", mapNumber(percent, 51, 75, 0, 100) + "%");
                $("#xp3").css("width","0%");
            } else if (percent <= 100) {
                $("#xp0").css("height","100%");
                $("#xp1").css("width","100%");
                $("#xp2").css("height","100%");
                $("#xp3").css("width", mapNumber(percent, 76, 100, 0, 100) + "%");
            }
    
            // Calculates percent of remaining life
            let lifePercent = (mPlayer.life / mPlayer.maxLife) * 100+ "%";

            if (mPlayer.life <= 0) $("#overlay").show();
            //console.log(lifePercent);
            document.getElementById("healthBar").style.width = lifePercent;
            document.getElementById("level").innerHTML = mPlayer.level;
            updateGUI = false;
        }
    });


});

class App extends Engine
{
    async start()
    {
        /** @type {WebGL2RenderingContext} */
        const gl = this.gl;


        this.loader = new GLTFLoader();
        this.pointerlockchangeHandler = this.pointerlockchangeHandler.bind(this);
        this.mousedownHandler = this.mousedownHandler.bind(this);
        document.addEventListener('pointerlockchange', this.pointerlockchangeHandler);
        document.addEventListener('mousedown', this.mousedownHandler);

        const floorModel = this.createModel(FloorModel);
        const greenTexture = Engine.createTexture(gl, {
            data: new Uint8Array([0, 255, 0, 255]),
            width: 1,
            height: 1
        });

        this.floor = new Node({
            name: "Floor",
            model: floorModel,
            texture: greenTexture
        });

        mat4.fromScaling(this.floor.transform, [30, 1, 30]);
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
    
        await this.loader.load("./assets/models/stickman/stickman.gltf");

        this.scene = await this.loader.loadScene(this.loader.defaultScene);
        this.scene.addNode(this.floor);

        this.player = this.scene.getNodeByName("Armature");
        this.player.translation = [mPlayer.x, 0, mPlayer.y]; // Sets player location to the one received from server

        this.scene.addNode(this.cube);

        this.camera = new PerspectiveCamera(); // create Camera manually
        this.scene.addNode(this.camera);
        
        // All nodes are loaded
        console.log("Nodes in the scene", this.scene.nodes);

        this.renderer = new Renderer(this.gl);
        this.renderer.prepareScene(this.scene);
    }


    update()
    {
        this.time = Date.now();
        const dt = (this.time - this.startTime) * 0.001;
        this.startTime = this.time;

        this.sinceStart = (this.sinceStart + dt) % 100;

        if (mPlayer !== undefined && this.player !== undefined) {
            mPlayer.x = this.player.translation[0];
            mPlayer.y = this.player.translation[2];

            mPlayer.mouseX = mPlayer.x - Math.sin(this.camera.rotation[1]);
            mPlayer.mouseY = mPlayer.y - Math.cos(this.camera.rotation[1]);
           
            let tmp = this.scene.getNodeByName("Aim");
            for (var i = 0; i < hits.length; i++) {
                hits[i].move();
                tmp.translation = [hits[i].x, 1, hits[i].y];
                tmp.updateTransform();
                if (HIT_RANGE > Math.abs(hits[i].x - hits[i].targetX) + Math.abs(hits[i].y - hits[i].targetY)) {
                    hits.splice(i, 1);
                }
            }
            mPlayer.health(hitsEnemy);
            updateGUI = true;
            // Enemy hits move/remove
            for (var i = 0; i < hitsEnemy.length; i++) {
                hitsEnemy[i].move();
                if (HIT_RANGE > Math.abs(hitsEnemy[i].x - hitsEnemy[i].targetX) + Math.abs(hitsEnemy[i].y - hitsEnemy[i].targetY)) {
                    hitsEnemy.splice(i, 1);
                }
            }
            if (this.player.completedCombo) {
                // Client sends completedCombo message to server and receives XP
                socket.emit('completedCombo');
                mPlayer.shoot(socket, hits, 2);
                this.player.completedCombo = false;
            }
            socket.emit('update', mPlayer, hits); // Send update message to server
        }


        if (this.camera)
        {
            this.camera.update(dt, this.player, mPlayer, otherPlayers);
        }
    }

    /**
     * @param {DOMHighResTimeStamp} sinceStart Current time (based on the number of milliseconds since document load)
     */
    render(sinceStart)
    {
        if (this.renderer && this.camera)
        {
            this.renderer.render(this.scene, this.player, this.camera, sinceStart);
        }
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
        /*if (e.which === 1) {
            console.log("Left click...");
            mPlayer.shoot(socket, hits, 0);
        } else if (e.which === 3) {
            console.log("Right click...");
        }*/
    }

}