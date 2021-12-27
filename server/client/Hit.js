export class Hit {
    constructor(igralec, x, y, targetX, targetY, weaponType) {
        this.player = igralec;
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

    move() {
        this.pX = this.x;
        this.pY = this.y;
        this.x = this.x + Math.cos(this.angle);
        this.y = this.y + Math.sin(this.angle);
    }

}