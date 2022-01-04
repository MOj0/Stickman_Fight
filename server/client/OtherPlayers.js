export class OtherPlayer {
    constructor(id, player, x, y, life, currAnimation, rotation, color) {
        this.id = id;
        this.player = player;
        this.x = x;
        this.y = y;
        this.r = 1;
        this.life = life;
        this.rotation = rotation || [0, 0, 0];
        this.currAnimation = currAnimation || "Idle";
        this.color = new Float32Array([color[0], color[1], color[2], 1]);
    }
}