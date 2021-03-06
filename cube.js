export const vertices = new Float32Array([
    -1, -1, -1,   0, 0 ,0,    0,  0,
    -1,  1, -1,   0, 0 ,0,    0,  1,
    -1, -1,  1,   0, 0 ,0,    1,  0,
    -1,  1,  1,   0, 0 ,0,    1,  1,
     1, -1,  1,   0, 0 ,0,    2,  0,
     1,  1,  1,   0, 0 ,0,    2,  1,
     1, -1, -1,   0, 0 ,0,    3,  0,
     1,  1, -1,   0, 0 ,0,    3,  1,
    -1, -1, -1,   0, 0 ,0,    4,  0,
    -1,  1, -1,   0, 0 ,0,    4,  1,
     1, -1, -1,   0, 0 ,0,    0, -1,
     1,  1, -1,   0, 0 ,0,    0,  2,
     1, -1,  1,   0, 0 ,0,    1, -1,
     1,  1,  1,   0, 0 ,0,    1,  2,
]);

export const indices = new Uint16Array([
     0,  2,  1,      1,  2,  3,
     2,  4,  3,      3,  4,  5,
     4,  6,  5,      5,  6,  7,
     6,  8,  7,      7,  8,  9,
     1,  3, 11,     11,  3, 13,
    10, 12,  0,      0, 12,  2,
]);
