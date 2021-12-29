export class Hit {
    constructor(igralec, x, y, targetX, targetY, hitType) {
        this.player = igralec;
        this.x = x;
        this.y = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.hitType = hitType;

        this.radarSize = 20;

        this.pX; // Previous X position
        this.pY; // Previous Y position

        this.diffX = this.targetX - this.x;
        this.diffY = this.targetY - this.y;
        this.angle = Math.atan2(this.diffY, this.diffX);
        this.damage = 5;
        
        // Setting damage for every hit type
        if (this.hitType === 0) {
            this.damage = 5;
        } else if (this.hitType === 1) {
            this.damage = 8;
        }
    }

    move() {
        this.pX = this.x;
        this.pY = this.y;
        this.x = this.x + Math.cos(this.angle);
        this.y = this.y + Math.sin(this.angle);
    }

}