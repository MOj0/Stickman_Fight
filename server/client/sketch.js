var socket;
var data;
var player;
var ipAddress;

var spawns = [];
var items = [];
var colors = ['blue', 'red'];
var scroll = [0, 2, 3]; // For weapon types
var scrollIndex = 0; // For scroll

var lasers = [];
var lasersEnemy = [];
var ais = [];
// p5.disableFriendlyErrors = true; //



function mapNumber(num, in_min, in_max, out_min, out_max) {
    return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}


function preload() {
    data = loadJSON('./maps/SpaceNarrow.json');
    // img = loadImage('maps/Map.png');
    // img = loadImage('./maps/Map_r.png');
    img = loadImage('./maps/MAP.png');

    playerImg = [loadImage('resources/ufoBlue.png'), loadImage('resources/ufoRed.png')];
    respawnImg = [loadImage('resources/ufoBlueTransparent.png'), loadImage('resources/ufoRedTransparent.png')];

    hitSound = loadSound('resources/hit.mp3');
    laserSound = loadSound('resources/laser.mp3');
    itemImages = [loadImage('resources/laser0Box.png'),
        loadImage('resources/radar.svg'),
        loadImage('resources/laser1Box.png'),
        loadImage('resources/laser2Box.png'),
        loadImage('resources/health.svg'),
        loadImage('resources/maxHealth.svg'),
        loadImage('resources/teleport.svg'),
        loadImage('resources/undefined.png'),
        loadImage('resources/jump.svg')
    ];
    eButton = loadImage('resources/e_button.png');
    planetImg = [loadImage('resources/BluePlanet.png'), loadImage('resources/RedPlanet.png')];
}


function setup() {
    ipAddress = window.location.host;
    console.log("Server IP ", ipAddress)
    //socket = io.connect('http://192.168.1.200:3000/');
    socket = io.connect(ipAddress + '/');
    //createCanvas(1920, 1080);//800/600
    createCanvas(1280, 720);
    frameRate(250);
    pixelDensity(1);
    angleMode(DEGREES);



    player = new Player("0:void", -500, -500, 1, 1, 1, "1", 0); // No player until it gets the real player from server

    // On 'start' message, server generates the player object and returns it as a response
    // Random UID generated is passed for database authentication
    let uid = (Math.random() + 1).toString(36).substring(2);
    console.log(uid);
    socket.emit('start', uid, function (playerData) {
        // Generating player
        player = new Player(playerData.player, playerData.x, playerData.y, playerData.life,
            playerData.maxLife, playerData.xp, playerData.level,
            playerData.spawnID, playerData.inventory);
        console.log(playerData);
    });
    socket.on('updatePosition', function (x, y) {
        player.x = x;
        player.y = y;
        console.log("Position from server: " + x + " - " + y);
    });
    socket.on('health', function (life) {
        player.life = life;
        console.log("Life from server: " + life);
    });
    socket.on('updateXP', function (xp) {
        player.xp = xp;
        console.log("XP from server: " + xp);
    });
    socket.on('updateLevel', function (level) {
        player.level = level;
        console.log("LEVEL from server: " + level);
    });
    socket.on('updateInventory', function (inventory) {
        player.inventory = inventory;
        console.log("INVENTORY from server: " + inventory);
    });
    socket.on('updateMaxLife', function (newMaxLife) {
        player.maxLife = newMaxLife;
        console.log("New MAXLIFE from server: " + newMaxLife);
    });
    socket.on('broadcastMessage', function (sender, message) {
        console.log("MESSAGE from " + sender + ": " + message);
        var messages = document.getElementById("messages");
        var team = parseInt(sender.split(':')[0]); // Get team ID
        var username = sender.split(':')[1]; // Username without the team ID
        var node = document.createElement("LI"); // Creates new <li> element
        node.className = colors[team]; // Adds red or blue class based on team ID
        node.innerHTML = "<b>" + username + ":</b> " + message; // Creates HTMl for message
        messages.appendChild(node); // Appends to <ul> MESSAGES

        if (messages.childElementCount >= 12) { // If there are more then 12 messages start removing them
            messages.removeChild(messages.childNodes[0]);
        }
    });
    socket.on('heartbeat',
        function (players, lasersAll, spawnsAll, itemsAll) {

            for (var i = 0; i < lasersAll.length; i++) {
                lasersEnemy.push(new Laser(lasersAll[i].player, lasersAll[i].x,
                    lasersAll[i].y, lasersAll[i].targetX, lasersAll[i].targetY,
                    lasersAll[i].weaponType));
            }

            // Receive and generate all other players
            ais.length = 0;
            for (var i = 0; i < players.length; i++) {
                ais.push(new Ai(players[i].id, players[i].player, players[i].x, players[i].y, players[i].life));
            }

            //console.log(items);
            /*items.length = 0;
            for (var i = 0; i < itemsAll.length; i++) {
              items.push(new Item(itemsAll[i].type, itemsAll[i].x, itemsAll[i].y));
            }*/
        });
    map = new Map(0, 0);

}


function draw() {

    background(51, 3, 71);
    translate(width / 2 - player.x, height / 2 - player.y);
    map.show();

    /*for (var i = 0; i < items.length; i++) {
      items[i].show();
    }*/

    // keycode.info
    if (keyIsDown(68)) {
        player.move(6);
    } else if (keyIsDown(65)) {
        player.move(4);
    }
    if (keyIsDown(87)) {
        player.move(8);
    } else if (keyIsDown(83)) {
        player.move(2);
    }

    // Show and check health for all other players
    for (var i = 0; i < ais.length; i++) { // Loop through all players
        if (ais[i].id !== socket.id) { // Prevents client to draw itself
            ais[i].show();
            ais[i].health();
        }
    }

    player.show();
    player.aim();


    // Player lasers show/move/limit/remove
    for (var i = 0; i < lasers.length; i++) {
        lasers[i].show();
        lasers[i].move();

        if (data[parseInt(lasers[i].y)][parseInt(lasers[i].x)] == 0) {
            if (lasers[i].weaponType === 0 || lasers[i].weaponType === 2 || lasers[i].weaponType === 3) { // Basic removal of normal lasers
                lasers.splice(i, 1);
            } else if (lasers[i].weaponType === 1 && lasers[i].radarSize > 4000) { // If the laser is a radar remove it after ceratin size
                lasers.splice(i, 1);
            }

        }
    }


    // Enemy lasers show/move/limit/remove
    for (var i = 0; i < lasersEnemy.length; i++) {
        lasersEnemy[i].show();
        lasersEnemy[i].move();

        if (data[parseInt(lasersEnemy[i].y)][parseInt(lasersEnemy[i].x)] == 0) {
            lasersEnemy.splice(i, 1);
        }

    }

    player.health();

    socket.emit('update', player, lasers); // Send update message to server



    player.xpForNextLevel = 200 + 75 * (player.level - 1);
    var totalXP = 37.5 * (player.level * player.level) + 87.5 * player.level - 125;
    // Calculates percente to get to new level
    let percent = 100 / player.xpForNextLevel * (player.xp - totalXP);

    if (percent <= 25) {
        $("#xp0").css("height", mapNumber(percent, 0, 25, 0, 100) + "%");
        $("#xp1").css("width", "0%");
        $("#xp2").css("height", "0%");
        $("#xp3").css("width", "0%");
    } else if (percent <= 50) {
        $("#xp0").css("height", "100%");
        $("#xp1").css("width", mapNumber(percent, 26, 50, 0, 100) + "%");
        $("#xp2").css("height", "0%");
        $("#xp3").css("width", "0%");
    } else if (percent <= 75) {
        $("#xp0").css("height", "100%");
        $("#xp1").css("width", "100%");
        $("#xp2").css("height", mapNumber(percent, 51, 75, 0, 100) + "%");
        $("#xp3").css("width", "0%");
    } else if (percent <= 100) {
        $("#xp0").css("height", "100%");
        $("#xp1").css("width", "100%");
        $("#xp2").css("height", "100%");
        $("#xp3").css("width", mapNumber(percent, 76, 100, 0, 100) + "%");
    }

    //drawXpMeter(xpMeterX, xpMeterY, 57*2 / player.xpForNextLevel * (player.xp-totalXP));

    // Calculates percent of remaining life
    let lifePercent = (player.life / player.maxLife) * 100 + "%";
    //console.log(lifePercent);
    document.getElementById("healthBar").style.width = lifePercent;
    document.getElementById("level").innerHTML = player.level;
    if (typeof player.inventory !== 'undefined') {
        for (var i = 0; i < 9; i++) {
            $("#itemCount" + i).html(player.inventory[i]);
        }
    }

    gameChat();
}



function mousePressed() {
    if (mouseButton == LEFT) {
        player.shoot();
    } else if (mouseButton == RIGHT) {

        if (player.itemType === 1) { // Radar usage
            if (player.inventory[1] > 0) { // Don't emit radar if inventory is empty
                player.inventory[1] -= 1; // Remove one radar from inventory
                var radar = new Laser(player.player, player.x, player.y, mouseX + player.x - width / 2, mouseY + player.y - height / 2, 1);
                lasers.push(radar);
            }
        } else if (player.itemType === 4) { // Health pack usage
            if (player.inventory[4] > 0) { // Don't heal if inventory is empty
                player.inventory[4] -= 1; // Remove one healing item from inventory
                if (player.life < player.maxLife - 50) {
                    player.life += 50;
                } else {
                    player.life = player.maxLife;
                }

            }
        } else if (player.itemType === 5) { // IncreaseMaxHealth
            if (player.inventory[5] > 0) {
                socket.emit('useItem', player.itemType); // Emit to server which item is used
                player.inventory[5] -= 1;

            }
        } else if (player.itemType === 6) { // Teleport
            if (player.inventory[6] > 0) { // Don't teleport if inventory is empty
                socket.emit('useItem', player.itemType);
                player.inventory[6] -= 1;


            }
        } else if (player.itemType === 8) { // Jump usage
            if (player.inventory[8] > 0) { // Don't jump if inventory is empty
                player.inventory[8] -= 1; // Remove one jump item from inventory
                player.moveSpeed = 20;
                setTimeout(resetMoveSpeed, 400); // Resets move speed in 400ms

            }
        }

    }
}

function resetMoveSpeed() {
    player.moveSpeed = 4;
}

function keyPressed() {
    var gameChatInput = document.getElementById('gameChatInput');
    if (keyCode === 27) { // ESC - for menu
        console.log("ESC");
        var gameMenu = document.getElementById('gameMenu');

        if (gameChatInput.style.display === "unset") { // If chat is open first close it
            gameChatInput.style.display = "none"; // Hide chat input
        } else { // Then go to primary ESC function
            if (gameMenu.style.display === "none") { // Show game menu
                gameMenu.style.display = "unset";
            } else {
                gameMenu.style.display = "none"; // Hide game menu
            }
        }
    } else if (keyCode === 111) { // Slash - for game chat
        console.log("/");

        // var gameChatInput = document.getElementById('gameChatInput');
        if (gameChatInput.style.display === "none") { // Show chat input
            gameChatInput.style.display = "unset";
            gameChatInput.select(); // Focus on input field so that the player can write

        } // Hide chat input is in ESC function
    } else if (keyCode === 49) { // 1 - item 1
        console.log("item 1");
        player.itemType = 1;
        $("#inventoryOutline>div.activeItem").removeClass("activeItem");
        $("#item" + 1).addClass("activeItem");
    } else if (keyCode === 50) { // 2 - item 4
        console.log("item 4");
        player.itemType = 4;
        $("#inventoryOutline>div.activeItem").removeClass("activeItem");
        $("#item" + 4).addClass("activeItem");
    } else if (keyCode === 51) { // 3 - item 5
        console.log("item 5");
        player.itemType = 5;
        $("#inventoryOutline>div.activeItem").removeClass("activeItem");
        $("#item" + 5).addClass("activeItem");
    } else if (keyCode === 52) { // 4 - item 6
        console.log("item 6");
        player.itemType = 6;
        $("#inventoryOutline>div.activeItem").removeClass("activeItem");
        $("#item" + 6).addClass("activeItem");
    }
    /*  else if (keyCode === 53) { // 5 - item 7
        console.log("item 7");
        player.itemType = 7;
      }*/
    else if (keyCode === 53) { // 5 - item 8
        console.log("item 8");
        player.itemType = 8;
        $("#inventoryOutline>div.activeItem").removeClass("activeItem");
        $("#item" + 8).addClass("activeItem");
    }

}


function mouseWheel(event) {
    if (event.delta < 0) { // Scroll UP
        scrollIndex--;
    } else if (event.delta > 0) { // Scroll DOWN
        scrollIndex++;
    }

    if (scrollIndex < 0) {
        scrollIndex = 2;
    } else if (scrollIndex > 2) {
        scrollIndex = 0;
    }

    player.weaponType = scroll[scrollIndex];
    $("#wTypeOutline>div.activeItem").removeClass("activeItem");
    $("#item" + player.weaponType).addClass("activeItem");
    console.log(event.delta);
}

function gameChat() {
    // Sets the canvasSize to the size of defaultCanvas0
    var height = document.getElementById('defaultCanvas0').clientHeight;
    document.getElementById('canvasSize').style.height = height + "px";

    // Remove first /
    var gameChatInput = document.getElementById('gameChatInput');
    if (gameChatInput.value[0] === "/") {
        gameChatInput.value = "";
    }

}



/**
 * https://github.com/infusion/Circle.js/
 * Circle.js v0.0.9 08/04/2016
 *
 * Copyright (c) 2016, Robert Eisele (robert@xarg.org)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 **/
function intersection(A, B) {
    var d = Math.hypot(B['x'] - A['x'], B['y'] - A['y']);

    if (d <= A['r'] + B['r'] && d >= Math.abs(B['r'] - A['r'])) {

        var x = (A['r'] * A['r'] - B['r'] * B['r'] + d * d) / (2 * d);
        var y = Math.sqrt(A['r'] * A['r'] - x * x);

        var eX = (B['x'] - A['x']) / d;
        var eY = (B['y'] - A['y']) / d;

        var P1 = {
            'x': A['x'] + x * eX - y * eY,
            'y': A['y'] + x * eY + y * eX
        };

        var P2 = {
            'x': A['x'] + x * eX + y * eY,
            'y': A['y'] + x * eY - y * eX
        };

        return [P1, P2];

    } else {

        // No Intersection, far outside or one circle is inside the other
        return null;
    }
}