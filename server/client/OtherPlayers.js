export class OtherPlayer{
  constructor(id, player, x, y, life){
    this.id = id;
    this.player = player;
    this.x = x;
    this.y = y;
    this.r = 1;
    this.life = life;
  }

  health(){
    for (var i = 0; i < lasers.length; i++) {
      if (dist(lasers[i].x, lasers[i].y, this.x, this.y) <= this.r/2){  // Distance between laser and player
        if (lasers[i].player.split(":")[0] !== this.player.split(":")[0]
            && lasers[i].weaponType === 0 || lasers[i].weaponType === 2){ // Ignore radar pulses
          hitSound.play();
          this.life -= lasers[i].damage;      // Damage taken
          lasers.splice(i, 1);                // Removes lasers that hit the player
        }
        else {
          if(lasers[i].weaponType !== 1){ // Do not remove radar pulses
            lasers.splice(i, 1);
          }
        }

      }
    }

    if(this.life <= 0){

      this.image = respawnImg[parseInt(this.player.split(':')[0])];
      image(this.image, this.x-50, this.y-51, 100, 100);
      fill(255,0,0);
    }
  }


}
