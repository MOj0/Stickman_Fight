import { Hit } from "./Hit.js";

export class MPlayer {
    constructor(player, x, y, life, maxLife, xp, level, spawn, inventory) {
        this.player = player;
        this.w = 1;
        this.h = 1;
        this.x = x;
        this.y = y;
        this.life = life;
        this.maxLife = maxLife;
        this.xp = xp;
        this.level = level;
        this.spawnID = spawn;
        this.inventory = inventory;
        this.rotation = [];
        this.currAnimation = "";

        this.setHitAnimation = false;
        this.random = 0;

        this.xpForNextLevel = 200;

        this.mouseX = 0;
        this.mouseY = 0;

        this.lastHit = "";
        this.hitTimeout = false;

        this.diffX;
        this.diffY;
        this.angle;
        this.i0;
        this.i1;
    }

    shoot(socket, hits, hitType, isCompletedCombo = false) {
        if (this.life > 0) {
            // console.log("hitting");
            var thisHit = new Hit(this.player, this.x, this.y, this.mouseX , this.mouseY, hitType, this.level);

            if (hitType === 2) { // Combo hits
                var comboHit = new Hit(this.player, this.x, this.y, this.mouseX , this.mouseY, hitType, this.level, isCompletedCombo);
                socket.emit('shoot', comboHit);
                hits.push(comboHit);
                for (let i = 0; i < 2; i++) {
                    socket.emit('shoot', thisHit);
                    hits.push(thisHit);
                }            
            } else if (hitType === 0) {
                if (this.inventory[0] > 0) {
                    this.inventory[0] -= 1;
                    socket.emit('shoot', thisHit);
                    hits.push(thisHit);
                }
            } else if (hitType === 1) { // Kick
                if (this.inventory[1] > 0) {
                    this.inventory[1] -= 1; 
                    socket.emit('shoot', thisHit);
                    hits.push(thisHit);
                }
            }
            this.hitTimeout = false;
        }
    }
    dist(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }
    health(socket, hitsEnemy) {
        for (var i = 0; i < hitsEnemy.length; i++) {
            if (hitsEnemy[i].player !== this.player &&
                this.dist(hitsEnemy[i].x, hitsEnemy[i].y, this.x, this.y) <= 5) { // Distance between laser and player
                //console.log(hitsEnemy[i]);
                this.lastHit = hitsEnemy[i].player;
                console.log("Got hit by: " + this.lastHit + " damage taken: " + hitsEnemy[i].damage);
                if (hitsEnemy[i].isCompletedCombo) {
                    socket.emit('completedCombo', hitsEnemy[i].player+"");
                    hitsEnemy[i].isCompletedCombo = false;
                }
                this.life -= hitsEnemy[i].damage; // Damage taken
                this.setHitAnimation = true;
                this.random = Math.random();
                setTimeout(() => this.setHitAnimation = false, 500);
                hitsEnemy.splice(i, 1); // Removes hits that hit the player
            }
        }

       // Set current animation to a random hit animation if player has not died yet
       if(this.setHitAnimation)
            this.currAnimation = this.random < 0.5 ? "Hit_Center" : this.random < 0.75 ? "Hit_L" : "Hit_R";
       
        if (this.life <= 0) {
            this.currAnimation = "Dies";
            // console.log("You died...");
        }

        // Reset animations
        if(!this.setHitAnimation && this.currAnimation.startsWith("Hit") || this.life > 0 && this.currAnimation == "Dies")
            this.currAnimation = ""; // Reset only if currAnimation is "Dies", or "Hit"...
    }
}
