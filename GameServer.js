var player;
var players = [];
var hitsAll = [];

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

function Player(id, uid, player, x, y, life, maxLife, xp, level) {
    this.id = id; // Socket ID
    this.uid = uid;
    this.player = player;
    this.w = 100;
    this.h = 100;
    this.x = x;
    this.y = y;
    this.life = life;
    this.hitType = 0;
    this.maxLife = maxLife;
    this.xp = xp;
    this.level = level;
    this.currAnimation = "";
    this.timeout = true; // Enable only one updatePlayer to run at a time
    this.xpTimeout = true; // Enable only one XP add to run at a time
    this.color = [];
}

function Hit(player, x, y, targetX, targetY, hitType, comboMultiplier, isCompletedCombo) {
    this.player = player;
    this.x = x;
    this.y = y;
    this.targetX = targetX;
    this.targetY = targetY;
    this.hitType = hitType;
    this.comboMultiplier = comboMultiplier;
    this.isCompletedCombo = isCompletedCombo;


}

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
    io.sockets.emit('heartbeat', players, hitsAll); // Broadcasts updated inforamtion to all clients
    hitsAll.length = 0;
}


// Socket.io listeners
io.sockets.on('connection',
    function (socket) {
        console.log("New client connected: " + socket.id);
        socket.on('start', function (uid, data) { // uid to authenticate user and data to be sent as a response
            console.log(socket.id + " sent a START request with UID: " + uid);
            let playerName = "" + Math.random();
            // Creating new Player object with data from database
            var player = new Player(socket.id, uid, playerName, random(-10, 25), random(-10, 25), 100, 100, 0, 1);

            data(player); // Data that is sent as a response(player object)
            players.push(player);
            io.sockets.emit('broadcastMessage', '9:SERVER', player.player + " has joined the game.");
            console.log("Spawning " + player.player);

        });


        socket.on('update', function (data, hits) {
            // console.log("updating...");
            var player;
            for (var i = 0; i < players.length; i++) {
                if (socket.id === players[i].id) {
                    player = players[i];

                    player.x = data.x;
                    player.y = data.y;
                    player.life = data.life;
                    player.lastHit = data.lastHit;
                    player.rotation = data.rotation;
                    player.currAnimation = data.currAnimation;
                    player.color = data.color;

                    if (player.life <= 0) {
                        // Loop through all players and assign XP(based on lasthit)
                        for (var j = 0; j < players.length; j++) {
                            if (players[j].player === player.lastHit) {
                                console.log("Giving 100XP to: "+players[j].player);
                                if (player.xpTimeout) {
                                    players[j].xp += 100;
                                    io.sockets.to(players[j].id).emit('updateXP', players[j].xp); // Update XP for the player who got XP
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

        socket.on('hit', function (playerHit) {
            var hit = new Hit(playerHit.player, playerHit.x,
                playerHit.y, playerHit.targetX,
                playerHit.targetY, playerHit.hitType, playerHit.comboMultiplier, playerHit.isCompletedCombo);
            hitsAll.push(hit);
            // console.log(playerHit, hit);
        });

        socket.on('completedCombo', function (giveTo) {
            for (var i = 0; i < players.length; i++) {
                if (giveTo === players[i].player) {
                    players[i].xp += 5;
                    players[i].level += 1;
                    io.sockets.to(players[i].id).emit('updateXP', players[i].xp);
                    io.sockets.to(players[i].id).emit('updateLevel', players[i].level);
                }
            }
        });
        socket.on('resetCombo', function () {
            for (var i = 0; i < players.length; i++) {
                if (socket.id === players[i].id) {
                    players[i].level = 1;
                    io.sockets.to(players[i].id).emit('updateLevel', players[i].level);
                }
            }
        });

        socket.on('disconnect', function () {
            console.log("Client has disconnected: " + socket.id);
            for (var i = 0; i < players.length; i++) {
                if (socket.id == players[i].id) {
                    // Broadcast disconnected player name
                    io.sockets.emit('broadcastRemovePlayer', players[i].player);
                    players.splice(i, 1);
                }
            }

        });
    });