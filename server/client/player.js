import { Laser } from "./bullet.js";

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
        //this.image = playerImg[0]; // Gets team ID from player name
        // DEV
        this.mouseX = 0;
        this.mouseY = 0;
        this.moveSpeed = 4;

        this.lastLaser = "";

        //
        this.diffX;
        this.diffY;
        this.angle;
        this.i0;
        this.i1;
    }

    show() {
        fill(0, 255, 0);
        // ellipse(this.x, this.y, this.w, this.h);
        if (this.life > 0) { // Resets image to image of life player
            this.image = playerImg[parseInt(this.player.split(':')[0])];
            image(this.image, this.x - 50, this.y - 51, 100, 100);
        }
        // image(this.image, this.x-50, this.y-51, 100, 100);

        fill(100, 100, 100);
        textAlign(CENTER);
        textSize(12);
        text(this.player, this.x, this.y + 80);


    }

    move(direction) {
        if (this.life > 0) {
            if (direction === 6) { // Right
                if (data[this.y][this.x + this.moveSpeed] == 1) {
                    this.x = this.x + this.moveSpeed;

                }
            } else if (direction === 4) { // Left
                if (data[this.y][this.x - this.moveSpeed] == 1) {
                    this.x = this.x - this.moveSpeed;

                }
            }
            if (direction === 8) { // Up
                if (data[this.y - this.moveSpeed][this.x] == 1) {
                    this.y = this.y - this.moveSpeed;

                }
            } else if (direction === 2) { // Down
                if (data[this.y + this.moveSpeed][this.x] == 1) {
                    this.y = this.y + this.moveSpeed;

                }
            }
        }
        //console.log(data[this.y][this.x]);
    }

    aim() {
        this.diffX = mouseX + this.x - width / 2 - this.x;
        this.diffY = mouseY + this.y - height / 2 - this.y;
        this.angle = Math.atan2(this.diffY, this.diffX);

        fill(0, 255, 0);
        line(this.x, this.y, mouseX + this.x - width / 2, mouseY + this.y - height / 2);
        ellipse(mouseX + this.x - width / 2, mouseY + this.y - height / 2, 5, 5);

        var circle0 = {
            x: mouseX + this.x - width / 2 - 20 * Math.cos(this.angle),
            y: mouseY + this.y - height / 2 - 20 * Math.sin(this.angle),
            r: 40
        };

        var circle1 = {
            x: mouseX + this.x - width / 2 + 20 * Math.cos(this.angle),
            y: mouseY + this.y - height / 2 + 20 * Math.sin(this.angle),
            r: 40
        };

        var i = intersection(circle0, circle1); // Calculates two intersection point of circles
        this.i0 = i[0];
        this.i1 = i[1];
    }

    shoot(socket, lasers) {
        if (this.life > 0) {
            var thisLaser = new Laser(this.player, this.x, this.y, this.mouseX , this.mouseY, this.weaponType);

            if (this.weaponType === 2) {
                if (this.inventory[2] > 0) { // Don't shoot if inventory is empty
                    this.inventory[2] -= 1; // Remove one laser from inventory
                    var leftLaser = new Laser(this.player, this.x, this.y, this.i0.x, this.i0.y, this.weaponType);
                    var rightLaser = new Laser(this.player, this.x, this.y, this.i1.x, this.i1.y, this.weaponType);
                    //laserSound.play();
                    socket.emit('shoot', thisLaser);
                    socket.emit('shoot', leftLaser);
                    socket.emit('shoot', rightLaser);
                    lasers.push(thisLaser);
                    lasers.push(leftLaser);
                    lasers.push(rightLaser);
                }
            } else if (this.weaponType === 0) { // Shoot only one laser
                if (this.inventory[0] > 0) { // Don't shoot if inventory is empty
                    this.inventory[0] -= 1; // Remove one laser from inventory
                    //laserSound.play();
                    socket.emit('shoot', thisLaser);
                    lasers.push(thisLaser);
                }
            } else if (this.weaponType === 3) { // Explosive lasers
                if (this.inventory[3] > 0) { // Don't shoot if inventory is empty
                    this.inventory[3] -= 1; // Remove one explosive laser from inventory
                    //laserSound.play();
                    thisLaser.weaponType = 3;
                    socket.emit('shoot', thisLaser);
                    lasers.push(thisLaser);
                }
            }

        }
    }
    dist(x1, y1, x2, y2) {
        return  Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }
    health(lasersEnemy) {
        for (var i = 0; i < lasersEnemy.length; i++) {
            if (lasersEnemy[i].player !== this.player &&
                this.dist(lasersEnemy[i].x, lasersEnemy[i].y, this.x, this.y) <= 3) { // Distance between laser and player
                //console.log(lasersEnemy[i]);
                this.lastLaser = lasersEnemy[i].player;
                console.log("Got hit by: " + this.lastLaser);
                this.life -= lasersEnemy[i].damage; // Damage taken
                lasersEnemy.splice(i, 1); // Removes lasers that hit the player
            }
        }

        if (this.life <= 0) {
            console.log("You died...");
        }

    }
}
