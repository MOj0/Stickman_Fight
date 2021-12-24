export class Laser {
    constructor(igralec, x, y, targetX, targetY, weaponType) {
        this.player = igralec;
        //this.color = colors[0]; // Izbere barvo iz tabele glede na ekipo igralca
        this.x = x;
        this.y = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.weaponType = weaponType;

        this.radarSize = 20;

        this.pX; // Previous X position
        this.pY; // Previous Y position

        this.diffX = this.targetX - this.x;
        this.diffY = this.targetY - this.y;
        this.angle = Math.atan2(this.diffY, this.diffX);

        // Setting damage for every weapon type
        if (this.weaponType === 0) {
            this.damage = 25;
        } else if (this.weaponType === 1) {
            this.damage = 0;
        } else if (this.weaponType === 2) {
            this.damage = 10;
        } else if (this.weaponType === 3) {
            this.damage = 25;
        }
    }

    show() {
        ellipse(this.targetX, this.targetY, 3, 3); // Shows where player clicked
        //line(this.x, this.y, this.targetX, this.targetY);
        /*a = Math.atan2(this.diffX, this.diffY)*(180/Math.PI);
        a = ((a < 0) ? a + 360 : a);
        console.log(a);*/
    }

    move() {
        if (this.weaponType !== 1) {
            //strokeWeight(5);
            //stroke(this.color);

            //line(this.x, this.y, this.pX, this.pY); // Longer laser
            //strokeWeight(1);
            //stroke('black');
            // ellipse(this.x, this.y, 5, 5);
            // ellipse(this.pX, this.pY, 5, 5);
        }

        //
        if (this.weaponType === 1 && this.player === player.player) { // Only execute for current player

            // var angle = this.angle * (180/Math.PI); // Angle of aim in DEGREES
            // angle = ((angle < 0) ? angle + 360 : angle);  // Converting to 0-360
            //arc(this.startingX, this.startingY, this.radarSize, this.radarSize, angle-90, angle+90);

            noFill();
            stroke('white');
            ellipse(player.x, player.y, this.radarSize, this.radarSize);
            ellipse(player.x, player.y, this.radarSize - 1, this.radarSize - 1);
            ellipse(player.x, player.y, this.radarSize - 2, this.radarSize - 2);
            stroke('black');
            for (var i = 0; i < ais.length; i++) { // Loop through all players
                if (ais[i].id !== socket.id) { // Prevents client to use itself
                    var distance = Math.sqrt((player.x - ais[i].x) ** 2 + (player.y - ais[i].y) ** 2);
                    //  var distance = Math.sqrt((this.startingX - ais[i].x)**2 + (this.startingY - ais[i].y)**2);  // Diagonal distance to other players
                    if (this.radarSize >= distance) {
                        var diffX = ais[i].x - player.x; //this.startingX;
                        var diffY = ais[i].y - player.y; //this.startingY;
                        var angleToPlayer = Math.atan2(diffY, diffX) * (180 / Math.PI);
                        angleToPlayer = ((angleToPlayer < 0) ? angleToPlayer + 360 : angleToPlayer); // Converting to 0-360
                        //console.log(angleToPlayer);
                        strokeWeight(5);
                        stroke('red');
                        arc(player.x, player.y, 200, 200, angleToPlayer - 20, angleToPlayer + 20);
                        strokeWeight(1);
                        stroke('black');
                    }
                }
            }
            this.radarSize = this.radarSize + 20; // Increases arch size
        } else if (this.weaponType === 3) { // Explosive laser
            if (dist(this.x, this.y, this.targetX, this.targetY) < 10) {
                for (var i = 0; i < 5; i++) {
                    var tempLaser = new Laser(this.player, this.x, this.y,
                        random(this.x - 200, this.x + 200), random(this.y - 200, this.y + 200), 0);
                    lasers.push(tempLaser);
                    socket.emit('shoot', tempLaser);
                    laserSound.play();

                }
            }
        }


        this.yyy = this.y;
        this.xxx = this.x;

        this.pX = this.x;
        this.pY = this.y;
        this.x = this.x + Math.cos(this.angle);
        this.y = this.y + Math.sin(this.angle);

        /*if (data[this.yyy][this.xxx] == 1 ||
            data[this.yyy][this.xxx] == 2){
        }*/


    }

}