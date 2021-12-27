import { Hit } from "./Hit.js";

export class MPlayer {
    constructor(player, x, y, life, maxLife, xp, level, spawn, inventory) {
        this.player = player;
        this.w = 1;
        this.h = 1;
        this.x = x;
        this.y = y;
        this.stableX = x;
        this.stableY = y;
        this.life = life;
        this.maxLife = maxLife;
        this.xp = xp;
        this.level = level;
        this.spawnID = spawn;
        this.inventory = inventory;

        this.xpForNextLevel = 200;

        this.weaponType = 0;
        this.itemType = 1;
       
        this.mouseX = 0;
        this.mouseY = 0;
        this.moveSpeed = 4;

        this.lastHit = "";

        this.diffX;
        this.diffY;
        this.angle;
        this.i0;
        this.i1;
    }

    shoot(socket, hits) {
        if (this.life > 0) {
            var thisHit = new Hit(this.player, this.x, this.y, this.mouseX , this.mouseY, this.weaponType);

            if (this.weaponType === 2) {
                if (this.inventory[2] > 0) { // Don't shoot if inventory is empty
                    this.inventory[2] -= 1; // Remove one laser from inventory
                    var leftHit = new Hit(this.player, this.x, this.y, this.i0.x, this.i0.y, this.weaponType);
                    var rightHit = new Hit(this.player, this.x, this.y, this.i1.x, this.i1.y, this.weaponType);
                    //hitsound.play();
                    socket.emit('shoot', thisHit);
                    socket.emit('shoot', leftHit);
                    socket.emit('shoot', rightHit);
                    hits.push(thisHit);
                    hits.push(leftHit);
                    hits.push(rightHit);
                }
            } else if (this.weaponType === 0) { // Shoot only one laser
                if (this.inventory[0] > 0) { // Don't shoot if inventory is empty
                    this.inventory[0] -= 1; // Remove one laser from inventory
                    //hitsound.play();
                    socket.emit('shoot', thisHit);
                    hits.push(thisHit);
                }
            } else if (this.weaponType === 3) { // Explosive hits
                if (this.inventory[3] > 0) { // Don't shoot if inventory is empty
                    this.inventory[3] -= 1; // Remove one explosive laser from inventory
                    //hitsound.play();
                    thisHit.weaponType = 3;
                    socket.emit('shoot', thisHit);
                    hits.push(thisHit);
                }
            }

        }
    }
    dist(x1, y1, x2, y2) {
        return  Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }
    health(hitsEnemy) {
        for (var i = 0; i < hitsEnemy.length; i++) {
            if (hitsEnemy[i].player !== this.player &&
                this.dist(hitsEnemy[i].x, hitsEnemy[i].y, this.x, this.y) <= 3) { // Distance between laser and player
                //console.log(hitsEnemy[i]);
                this.lastHit = hitsEnemy[i].player;
                console.log("Got hit by: " + this.lastHit);
                this.life -= hitsEnemy[i].damage; // Damage taken
                hitsEnemy.splice(i, 1); // Removes hits that hit the player
            }
        }

        if (this.life <= 0) {
            console.log("You died...");
        }

    }
}
