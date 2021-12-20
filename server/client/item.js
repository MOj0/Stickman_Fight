class Item {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
  }

  show(){
    // ellipse(this.x, this.y, 20);
    image(itemImages[this.type], this.x-20, this.y-20, 40, 40);
  }
}
