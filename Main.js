"use strict";

import { GUI } from './lib/dat.gui.module.js';
import { mat4 } from './lib/gl-matrix-module.js';
import { Engine } from './Engine.js';
import { Node } from './Node.js';
import * as FloorModel from "./floor.js";
import { PerspectiveCamera } from './PerspectiveCamera.js';
import { Renderer } from "./Renderer.js";
import { MPlayer } from "./server/client/player.js";
import { OtherPlayer } from "./server/client/OtherPlayers.js";
import { Hit } from "./server/client/Hit.js";
import { GLTFLoader } from "./GLTFLoader.js";
import { Light } from './Light.js';


let socket;
let mPlayer;
let ipAddress;
let hits = [];
let hitsEnemy = [];
let updateGUI = true;
let otherPlayers = [];
let otherPlayerNodes = [];
let otherPlayerIndicators = [];

const HIT_RANGE = 0.5;

function mapNumber(num, in_min, in_max, out_min, out_max)
{
    return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

document.addEventListener("DOMContentLoaded", () =>
{
    ipAddress = window.location.host;
    // console.log("Server IP ", ipAddress)
    socket = io.connect(ipAddress + '/');
    $("#overlay").hide();

    const canvas = document.querySelector("canvas");
    const app = new App(canvas);
    
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
        $("#xpCount").addClass("jump");
        setTimeout(() => {$("#xpCount").removeClass("jump");}, 500);
        console.log("XP from server: "+xp);
    });
      socket.on('updateLevel', function(level){
        mPlayer.level = level;
        console.log("LEVEL from server: "+level);
    });

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
            hitsAll[i].weaponType, hitsAll[i].comboMultiplier, hitsAll[i].isCompletedCombo));
        }
        // Receive and generate all other players
        otherPlayers.length = 0;
        otherPlayerNodes.length = 0;
        for (var i = 0; i < players.length; i++) {
            if (mPlayer !== undefined && mPlayer.player !== players[i].player) {
                otherPlayers.push(
                    new OtherPlayer(
                        players[i].id, players[i].player, players[i].x, players[i].y,
                        players[i].life, players[i].currAnimation, players[i].rotation,
                        players[i].color
                ));
            }
        }
        
        if(app.loader !== undefined)
        {
            for (var i = 0; i < otherPlayers.length; i++)
            {
                if (app.scene !== undefined) app.removeNodeByName(app.scene.nodes, otherPlayers[i].player);
    
                const tmp = new Node(app.loader.playerOptions);
                tmp.name = otherPlayers[i].player;
                tmp.currAnimation = otherPlayers[i].currAnimation;
                tmp.color = otherPlayers[i].color;

                if (app.scene !== undefined) app.scene.addNode(tmp);
            }
        }

        if (app.scene !== undefined) {
            for (let i in otherPlayers) {
                let tmp = app.scene.getNodeByName(otherPlayers[i].player);
                if (tmp !== undefined) {
                    tmp.translation = [otherPlayers[i].x, 0, otherPlayers[i].y];
                    tmp.rotation = otherPlayers[i].rotation;
                    tmp.updateTransform();
                }
            }
        }
        
        if (mPlayer && updateGUI)
        {
            // Calculates percent of remaining life
            let lifePercent = (mPlayer.life / mPlayer.maxLife) * 100+ "%";

            if (mPlayer.life <= 0) $("#overlay").show();
            //console.log(lifePercent);
            document.getElementById("playerHealthBar").style.width = lifePercent;
            document.getElementById("playerHealthBar").style.backgroundColor = 
                `rgba(${mapNumber((mPlayer.life / mPlayer.maxLife) * 100, 0, 100, 255, 0)},
                      ${mapNumber((mPlayer.life / mPlayer.maxLife) * 100, 0, 100, 0, 255)}, 0)`;
            
            document.getElementById("level").innerHTML = mPlayer.level;
            document.getElementById("xpCount").innerHTML = mPlayer.xp + " XP";


            otherPlayerIndicators = [];
            $("#otherPlayerIndicators").html("");
            for (var i = 0; i < otherPlayers.length; i++)
            {
                if (Math.abs(mPlayer.x - otherPlayers[i].x) + Math.abs(mPlayer.y - otherPlayers[i].y) < 20)
                {
                    otherPlayerIndicators.push([otherPlayers[i].player, otherPlayers[i].life]);
                }
            }
            for (var i = 0; i < otherPlayerIndicators.length; i++)
            {
                let playerName = otherPlayerIndicators[i][0]+"";
                let playerLife = otherPlayerIndicators[i][1];
                $("#otherPlayerIndicators").append(`<div id="outer-${playerName}" class="enemyHealthBarOutline"><div id="${playerName}" class="enemyHealthBar"></div></div>`);
                lifePercent = (playerLife / 100) * 100+ "%";
                document.getElementById(playerName).style.width = lifePercent;
                document.getElementById("outer-"+playerName).style.top = 45 + i*80 + "%";
                document.getElementById(playerName).style.backgroundColor = 
                    `rgba(${mapNumber((playerLife / 100) * 100, 0, 100, 255, 0)},
                          ${mapNumber((playerLife / 100) * 100, 0, 100, 0, 255)}, 0)`;
            }
            updateGUI = false;
        }
    });

    // Debug
    const gui = new GUI();
    gui.add(app.light, 'ambient', 0.0, 1.0);
    gui.add(app.light, 'diffuse', 0.0, 1.0);
    gui.add(app.light, 'specular', 0.0, 1.0);
    gui.add(app.light, 'shininess', 0.0, 1000.0);
    gui.addColor(app.light, 'color');
    for (let i = 0; i < 3; i++) {
        gui.add(app.light.position, i, -100.0, 100.0).name('position.' + String.fromCharCode('x'.charCodeAt(0) + i));
    }
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

        const FloorModel = this.createFloorModel(10, 10);
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
        mat4.fromScaling(this.floor.transform, [300, 1, 300]);

        this.light = new Light();

        await this.loader.load("./assets/models/stickman/stickman.gltf");

        this.scene = await this.loader.loadScene(this.loader.defaultScene);
        this.scene.addNode(this.floor);
        this.scene.addNode(this.light);

        this.player = this.scene.getNodeByName("Armature");
        this.player.translation = [mPlayer.x, 0, mPlayer.y]; // Sets player location to the one received from server
        this.player.color = mPlayer.color; // Set color to the one recieved from server

        this.camera = new PerspectiveCamera(); // create Camera manually

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
            mPlayer.rotation = this.player.rotation;

            mPlayer.mouseX = mPlayer.x + Math.sin(this.camera.rotation[1]);
            mPlayer.mouseY = mPlayer.y + Math.cos(this.camera.rotation[1]);
           
            for (var i = 0; i < hits.length; i++) {
                hits[i].move();
                if (HIT_RANGE > Math.abs(hits[i].x - hits[i].targetX) + Math.abs(hits[i].y - hits[i].targetY)) {
                    hits.splice(i, 1);
                }
            }
            mPlayer.health(socket, hitsEnemy);
            if(mPlayer.currAnimation == "Dies" || mPlayer.currAnimation.startsWith("Hit"))
            {
                this.player.currAnimation = mPlayer.currAnimation; // Set the animation to the one it recieved from the server
                this.player.resetAnimation = false;
            }
            updateGUI = true;
            // Enemy hits move/remove
            for (var i = 0; i < hitsEnemy.length; i++) {
                hitsEnemy[i].move();
                if (HIT_RANGE > Math.abs(hitsEnemy[i].x - hitsEnemy[i].targetX) + Math.abs(hitsEnemy[i].y - hitsEnemy[i].targetY)) {
                    hitsEnemy.splice(i, 1);
                }
            }
            if (this.player.completedCombo !== "")
            {
                // Client sends completedCombo message to server and receives XP
                if (this.player.completedCombo === "COMPLETED")
                {
                    //socket.emit('completedCombo');
                    mPlayer.shoot(socket, hits, 2, true);
                }
                else if (this.player.completedCombo === "FAILED")
                {
                    socket.emit('resetCombo');
                }
                this.player.completedCombo = "";
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
            this.renderer.render(this.scene, this.player, this.camera, this.light, sinceStart);
        }
    }

    resize()
    {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        this.aspect = w / h;
        if (this.camera) {
            this.camera.aspect = this.aspect;
            this.camera.updateProjection();
        }
    }

    pointerlockchangeHandler()
    {
        if (document.pointerLockElement === this.canvas && this.camera)
        {
            this.camera.enable();
        }
        else if(this.camera)
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

        const indices = model.indices.length;
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indices, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);

        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);

        return { vao, indices };
    }

    createFloorModel(width, height) 
    {
        let vertices = [];
        for (let j = 0; j <= height; j++) {
            for (let i = 0; i <= width; i++) {
                const x = i - width / 2;
                const z = j - height / 2;
                const y = Math.random() / 4;

                // position
                vertices.push(x);
                vertices.push(y);
                vertices.push(z);

                // normal
                vertices.push(0);
                vertices.push(1);
                vertices.push(0);

                // texcoords
                vertices.push(x);
                vertices.push(z);
            }
        }

        let indices = [];
        for (let j = 0; j < height; j++) {
            for (let i = 0; i < width; i++) {
                indices.push(i + j * (width + 1));
                indices.push(i + (j + 1) * (width + 1));
                indices.push((i + 1) + j * (width + 1));
                indices.push((i + 1) + j * (width + 1));
                indices.push(i + (j + 1) * (width + 1));
                indices.push((i + 1) + (j + 1) * (width + 1));
            }
        }

        vertices = new Float32Array(vertices);
        indices = new Uint16Array(indices);

        return { vertices, indices };
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
}