var player;
var players = [];
var hitsAll = [];
var spawns = [];
var items = [];

totalXPTable = [0, 200, 475, 825, 1250, 1750, 2325, 2975, 3700, 4500, 5375, 6325, 7350, 8450, 9625, 10875, 12200, 13600, 15075, 16625, 18250, 19950, 21725, 23575, 25500, 27500, 29575, 31725, 33950, 36250, 38625, 41075, 43600, 46200, 48875, 51625, 54450, 57350, 60325, 63375, 66500, 69700, 72975, 76325, 79750, 83250, 86825, 90475, 94200, 98000, 101875, 105825, 109850, 113950, 118125, 122375, 126700, 131100, 135575, 140125, 144750, 149450, 154225, 159075, 164000, 169000, 174075, 179225, 184450, 189750, 195125, 200575, 206100, 211700, 217375, 223125, 228950, 234850, 240825, 246875, 253000, 259200, 265475, 271825, 278250, 284750, 291325, 297975, 304700, 311500, 318375, 325325, 332350, 339450, 346625, 353875, 361200, 368600, 376075, 383625, 391250, 398950, 406725, 414575, 422500, 430500, 438575, 446725, 454950, 463250, 471625, 480075, 488600, 497200, 505875, 514625, 523450, 532350, 541325, 550375, 559500, 568700, 577975, 587325, 596750, 606250, 615825, 625475, 635200, 645000, 654875, 664825, 674850, 684950, 695125, 705375, 715700, 726100, 736575, 747125, 757750, 768450, 779225, 790075, 801000, 812000, 823075, 834225, 845450, 856750, 868125, 879575, 891100, 902700, 914375, 926125, 937950, 949850, 961825, 973875, 986000, 998200, 1010475, 1022825, 1035250, 1047750, 1060325, 1072975, 1085700, 1098500, 1111375, 1124325, 1137350, 1150450, 1163625, 1176875, 1190200, 1203600, 1217075, 1230625, 1244250, 1257950, 1271725, 1285575, 1299500, 1313500, 1327575, 1341725, 1355950, 1370250, 1384625, 1399075, 1413600, 1428200, 1442875, 1457625, 1472450, 1487350, 1502325, 1517375, 1532500, 1547700, 1562975, 1578325, 1593750, 1609250, 1624825, 1640475, 1656200, 1672000, 1687875, 1703825, 1719850, 1735950, 1752125, 1768375, 1784700, 1801100, 1817575, 1834125, 1850750, 1867450, 1884225, 1901075, 1918000, 1935000, 1952075, 1969225, 1986450, 2003750, 2021125, 2038575, 2056100, 2073700, 2091375, 2109125, 2126950, 2144850, 2162825, 2180875, 2199000, 2217200, 2235475, 2253825, 2272250, 2290750, 2309325, 2327975, 2346700, 2365500, 2384375, 2403325, 2422350, 2441450, 2460625, 2479875, 2499200, 2518600, 2538075, 2557625, 2577250, 2596950, 2616725, 2636575, 2656500, 2676500, 2696575, 2716725, 2736950, 2757250, 2777625, 2798075, 2818600, 2839200, 2859875, 2880625, 2901450, 2922350, 2943325, 2964375];

let inventory = { // Change values as needed
    0: 100000, // Normal hits
    1: 3, // Item / Radar
    2: 5, // 3 hits
    3: 3, // Explosive hits
    4: 0, // Health
    5: 0, // IncreaseMaxHealth
    6: 0, // Teleport
    7: 0, // ??
    8: 0 // Jump
}

function queryXPLookupTable(currentXP) { // Return player level
    for (var i = 0; i < totalXPTable.length; i++) {
        if (currentXP < totalXPTable[i]) {
            return i;
        }
    }
}

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem() {
    let randInt = random(0, 100);
    if (randInt < 30) { // 30%
        return 0;
    } else if (randInt < 50) { // 20%
        return 4;
    } else if (randInt < 60) { // 10%
        return 1;
    } else if (randInt < 70) { // 10%
        return 2;
    } else if (randInt < 80) { // 10%
        return 3;
    } else if (randInt < 90) { // 10%
        return 8;
    } else if (randInt < 95) { // 5%
        return 5;
    }
    return 6; // 5%
}

function updatePlayer(socketID, x, y, life) {
    io.sockets.to(socketID).emit('updatePosition', x, y);
    io.sockets.to(socketID).emit('health', life);
    // Waits for client to receive health and position update to reset the updatePlayer timeout
    setTimeout(function () {
        for (var i = 0; i < players.length; i++) {
            if (socketID === players[i].id) {
                console.log("Reseting timeouts for: " + players[i].player);
                players[i].timeout = true;
                players[i].xpTimeout = true;
                players[i].lastHit = "";
            }
        }
    }, 4000);

}

function dist(arg0, arg1, arg2, arg3) {
    return Math.hypot(arg2 - arg0, arg3 - arg1);
}

function lerp(start, stop, amt) {
    return amt * (stop - start) + start;
}

function Item(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
}

function Player(id, uid, player, x, y, life, spawnID, maxLife, xp, level, inventory) {
    this.id = id; // Socket ID
    this.uid = uid;
    this.player = player;
    this.w = 100;
    this.h = 100;
    this.x = x;
    this.y = y;
    this.life = life;
    this.weaponType = 0;
    this.spawnID = spawnID;
    this.maxLife = maxLife;
    this.xp = xp;
    this.level = level;
    this.inventory = inventory;
    this.timeout = true; // Enable only one updatePlayer to run at a time
    this.xpTimeout = true; // Enable only one XP add to run at a time
}

function Hit(player, x, y, targetX, targetY, weaponType) {
    this.player = player;
    this.x = x;
    this.y = y;
    this.targetX = targetX;
    this.targetY = targetY;
    this.weaponType = weaponType;

}


/*for (var i = 0; i < 10; i++) {
  items.push(new Item(randomItem(), random(1000, 3000), random(1000, 3000)));
}
console.log(items);*/

var mapJSON = require('./server/maps/SpaceNarrow.json'); // Loads map

var express = require('express');
var app = express();
var compression = require('compression');


var server = app.listen(process.env.PORT || 7777, listen);

function listen() {
    var port = server.address().port;
    // console.log(server.address());
    console.log('Server listening at http://0.0.0.0:' + port);
}

app.use(compression());
app.use(express.json());
app.use(express.urlencoded())
app.use(express.static(__dirname)); // Serve the / directory
app.use(express.static(__dirname + "/server"));
app.use(express.static(__dirname + "/server/client"));
app.use(express.static(__dirname + "/server/client/maps"));



var io = require('socket.io')(server, {
    cors: {
        origin: "http://localhost",
        methods: ["GET", "POST"],
        transports: ['websocket', 'polling'],
        credentials: true
    },
    allowEIO3: true
});

setInterval(heartbeat, 10);

function heartbeat() {
    for (var i = 0; i < players.length; i++) {
        for (var j = 0; j < items.length; j++) {
            if (dist(players[i].x, players[i].y, items[j].x, items[j].y) <= 70) {
                // Give item to player
                var itemType = items[j].type;
                if (itemType === 0) { // Give 10 normal hits
                    players[i].inventory[itemType] += 9;
                }
                players[i].inventory[itemType] += 1;
                console.log("Giving item " + itemType + " to player: " + players[i].player);
                io.sockets.to(players[i].id).emit('updateInventory', players[i].inventory);
                items.splice(j, 1);
                items.push(new Item(randomItem(), random(1000, 4000), random(1000, 4000))); // For each removed item add a new one

            }
        }
    }

    io.sockets.emit('heartbeat', players, hitsAll, spawns, items); // Broadcasts updated inforamtion to all clients
    hitsAll.length = 0;

}



// Socket.io
io.sockets.on('connection',
    function (socket) {
        console.log("New client connected: " + socket.id);
        socket.on('start', function (uid, data) { // uid to authenticate user and data to be sent as a response
            console.log(socket.id + " sent a START request with UID: " + uid);
            let playerName = "" + Math.random();
            // Creating new Player object with data from database
            var player = new Player(socket.id, uid, playerName, random(-10, 25), random(-10, 25), 100, "", 100, 0, 0, inventory);

            data(player); // Data that is sent as a response(player object)
            players.push(player);
            io.sockets.emit('broadcastMessage', '9:SERVER', player.player + " has joined the game.");
            console.log("Spawning " + player.player);

        });


        socket.on('update', function (data, hits) {
            // console.log("updating...");
            var player;
            var spawnX;
            var spawnY;
            for (var i = 0; i < players.length; i++) {
                if (socket.id === players[i].id) {
                    player = players[i];

                    player.x = data.x;
                    player.y = data.y;
                    player.life = data.life;
                    player.lastHit = data.lastHit;
                    player.inventory = data.inventory;

                    if (player.life <= 0) {
                        // console.log("Last hit: " + player.lasthit);

                        // Loop through all players and assign XP(based on lasthit)
                        for (var j = 0; j < players.length; j++) {
                            if (players[j].player === player.lastHit) {
                                // console.log("Give 100XP to: "+players[j].player);

                                if (player.xpTimeout) {
                                    players[j].xp += 100;
                                    io.sockets.to(players[j].id).emit('updateXP', players[j].xp); // Update XP for the player who got XP
                                    io.sockets.to(players[j].id).emit('updateLevel', queryXPLookupTable(players[j].xp)); // Update LEVEL in case the player leveled UP
                                    player.xpTimeout = false;
                                }
                            }
                        }

                        // With timeout
                        if (player.timeout) {
                            console.log("Respawning player: " + player.player);
                            setTimeout(function () {
                                updatePlayer(player.id, random(-10, 25), random(-10, 25), player.maxLife);
                            }, 4000);
                            player.timeout = false;

                        }
                    }
                    players[i] = player;
                }
            }

        });

        socket.on('shoot', function (playerHit) {
            var hit = new Hit(playerHit.player, playerHit.x,
                playerHit.y, playerHit.targetX,
                playerHit.targetY, playerHit.weaponType);
            hitsAll.push(hit);
            // console.log(hitsAll);
        });


        socket.on('message', function (message) {
            for (var i = 0; i < players.length; i++) {
                if (socket.id === players[i].id) {
                    console.log(players[i].player + " said: " + message);
                    // Broadcast to all players
                    io.sockets.emit('broadcastMessage', players[i].player, message);

                }
            }
        });

        socket.on('disconnect', function () {
            console.log("Client has disconnected: " + socket.id);
            for (var i = 0; i < players.length; i++) {
                if (socket.id == players[i].id) {
                    // Broadcast disconnected player name
                    io.sockets.emit('broadcastRemovePlayer', players[i].player);
                    io.sockets.emit('broadcastMessage', '9:SERVER', players[i].player.split(':')[1] + " has left the game.");
                    players.splice(i, 1);
                }
            }

        });
    });