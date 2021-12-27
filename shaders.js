const vertex = /*glsl*/`#version 300 es

uniform mat4 uModelViewProjection;
uniform mat4 uBones[42];

layout (location = 0) in vec4 aPosition;
layout (location = 1) in vec2 aTexCoord;

layout (location = 2) in highp vec2 aSIndices;
layout (location = 3) in highp vec2 aSWeights;

out vec2 vTexCoord;

mat4 boneTransform() {
  mat4 ret;

  // Weight normalization factor, only account for 2 bones -> NOTE: POTENTIAL PROBLEM
  float normfac = 1.0 / (aSWeights.x + aSWeights.y);

  // Weight1 * Bone1 + Weight2 * Bone2
  ret = normfac * aSWeights.y * uBones[int(aSIndices.y)]
      + normfac * aSWeights.x * uBones[int(aSIndices.x)];

  return ret;
}

void main() {
  mat4 bt = (length(aSWeights) > 0.5) ? 
    boneTransform() 
    : 
    mat4(
        1., 0., 0., 0.,
        0., 1., 0., 0.,
        0., 0., 1., 0.,
        0., 0., 0., 1.
    );

  vTexCoord = aTexCoord;
  gl_Position = uModelViewProjection * bt * aPosition;
}
`;


const fragment = /*glsl*/`#version 300 es

precision highp float;

uniform highp sampler2D uTexture;

in vec2 vTexCoord;

out vec4 oColor;

void main() {
  oColor = texture(uTexture, vTexCoord);
}
`;

export const shaders = {
    shader: { vertex, fragment }
};