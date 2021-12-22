export class MPlayer{
  constructor(player, x, y, life, maxLife, xp, level, spawn, inventory){
    this.player = player;
    this.w = 100;
    this.h = 100;
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

    this.moveSpeed = 4;

    this.lastLaser = "";

    //
    this.diffX;
    this.diffY;
    this.angle;
    this.i0;
    this.i1;
  }

  show(){
    fill(0, 255, 0);
    // ellipse(this.x, this.y, this.w, this.h);
    if (this.life > 0){ // Resets image to image of life player
      this.image = playerImg[parseInt(this.player.split(':')[0])];
      image(this.image, this.x-50, this.y-51, 100, 100);
    }
    // image(this.image, this.x-50, this.y-51, 100, 100);

    fill(100, 100, 100); textAlign(CENTER); textSize(12);
    text(this.player, this.x, this.y+80);


  }

  move(direction){
    if (this.life > 0){
      if (direction === 6) { // Right
        if(data[this.y][this.x + this.moveSpeed]  == 1){
          this.x = this.x + this.moveSpeed;

        }
      } else if (direction === 4) { // Left
        if(data[this.y][this.x - this.moveSpeed]  == 1){
          this.x = this.x - this.moveSpeed;

        }
      }
      if (direction === 8) { // Up
        if(data[this.y - this.moveSpeed][this.x]  == 1){
          this.y = this.y - this.moveSpeed;

        }
      } else if (direction === 2) { // Down
        if(data[this.y + this.moveSpeed][this.x]  == 1){
          this.y = this.y + this.moveSpeed;

        }
      }
    }
    //console.log(data[this.y][this.x]);
  }

  aim(){
    this.diffX =  mouseX+this.x-width/2 - this.x;
    this.diffY = mouseY+this.y-height/2 - this.y;
    this.angle = Math.atan2(this.diffY, this.diffX);

    fill(0, 255, 0);
    line(this.x, this.y, mouseX+this.x-width/2, mouseY+this.y-height/2);
    ellipse(mouseX+this.x-width/2, mouseY+this.y-height/2, 5, 5);

    var circle0 = {x:mouseX+this.x-width/2 - 20 * Math.cos(this.angle),
                   y:mouseY+this.y-height/2 - 20 * Math.sin(this.angle), r:40};

    var circle1 = {x:mouseX+this.x-width/2 + 20 * Math.cos(this.angle),
                   y:mouseY+this.y-height/2 + 20 * Math.sin(this.angle), r:40};

    var i = intersection(circle0, circle1); // Calculates two intersection point of circles
    this.i0 = i[0];
    this.i1 = i[1];
    // Visual way of seeing what is calculated
    // noFill();
    // line(i[0].x, i[0].y, i[1].x, i[1].y);
    // ellipse(i[0].x, i[0].y, 3, 3);
    // ellipse(i[1].x, i[1].y, 3, 3);
    // ellipse(mouseX+this.x-width/2 - 20 * Math.cos(this.angle),
    //         mouseY+this.y-height/2 - 20 * Math.sin(this.angle), 80, 80);
    // ellipse(mouseX+this.x-width/2 + 20 * Math.cos(this.angle),
    //         mouseY+this.y-height/2 + 20 * Math.sin(this.angle), 80, 80);

  }

  shoot() {
    if (this.life > 0){
      var thisLaser = new Laser(this.player, this.x, this.y, mouseX+this.x-width/2, mouseY+this.y-height/2, this.weaponType);

      if (this.weaponType === 2) {
        if (this.inventory[2] > 0) { // Don't shoot if inventory is empty
          this.inventory[2] -= 1; // Remove one laser from inventory
          var leftLaser = new Laser(this.player, this.x, this.y, this.i0.x, this.i0.y, this.weaponType);
          var rightLaser = new Laser(this.player, this.x, this.y, this.i1.x, this.i1.y, this.weaponType);
          laserSound.play();
          socket.emit('shoot', thisLaser);
          socket.emit('shoot', leftLaser);
          socket.emit('shoot', rightLaser);
          lasers.push(thisLaser);
          lasers.push(leftLaser);
          lasers.push(rightLaser);
        }
      }
      else if (this.weaponType === 0) { // Shoot only one laser
        if (this.inventory[0] > 0) { // Don't shoot if inventory is empty
          this.inventory[0] -= 1; // Remove one laser from inventory
          laserSound.play();
          socket.emit('shoot', thisLaser);
          lasers.push(thisLaser);
        }
      }
      else if (this.weaponType === 3) { // Explosive lasers
        if (this.inventory[3] > 0) { // Don't shoot if inventory is empty
          this.inventory[3] -= 1; // Remove one explosive laser from inventory
          laserSound.play();
          thisLaser.weaponType = 3;
          socket.emit('shoot', thisLaser);
          lasers.push(thisLaser);
        }
      }

    }
  }

  health(){
    for (var i = 0; i < lasersEnemy.length; i++) {
      if (dist(lasersEnemy[i].x, lasersEnemy[i].y, this.x, this.y) <= this.h/2){  // Distance between laser and player
        if (lasersEnemy[i].player.split(":")[0] != this.player.split(":")[0]){
              //console.log(lasersEnemy[i]);
          this.lastLaser = lasersEnemy[i].player;
          console.log("Got hit by: " + this.lastLaser);
          this.life -= lasersEnemy[i].damage;      // Damage taken
          lasersEnemy.splice(i, 1); // Removes lasers that hit the player
        }
        else {
          if(lasersEnemy[i].weaponType !== 1){ // Do not remove radar pulses
            lasersEnemy.splice(i, 1);    // Removes lasers that hit the player
          }

        }

      }
    }


    if(this.life <= 0){

      this.image = respawnImg[0];
      image(this.image, this.x-50, this.y-51, 100, 100);

      textAlign(CENTER);
      textSize(64);
      text("You DIED", this.x, this.y-50);
    }

  }
}







// Function for displaying the map

function Map(x, y){
  this.x = x;
  this.y = y;

  this.show = function(){
    image(img, this.x, this.y, 4500, 4500);
    noFill();
    stroke(143, 143, 143);
    rect(650, 360, 4500-650*2, 4500-360*2);
    stroke('black');
  }

}
