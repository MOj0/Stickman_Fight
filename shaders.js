const vertex = /*glsl*/`#version 300 es

uniform mat4 uProjection;
uniform mat4 uViewModel;

uniform mat4 uBones[42];

uniform bool uDrawOutline;

uniform vec3 uLightPosition;
uniform vec3 uLightAttenuation;

out vec3 vEye;
out vec3 vLight;
out vec3 vNormal;
out vec2 vTexCoord;
out float vAttenuation;

layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec2 aTexCoord;

layout (location = 3) in highp vec2 aSIndices;
layout (location = 4) in highp vec2 aSWeights;

mat4 boneTransform()
{
  mat4 ret;
  // Weight normalization factor
  float normfac = 1.0 / (aSWeights.x + aSWeights.y);
  // Weight1 * Bone1 + Weight2 * Bone2
  ret = normfac * aSWeights.y * uBones[int(aSIndices.y)]
      + normfac * aSWeights.x * uBones[int(aSIndices.x)];
  return ret;
}
void main()
{
  mat4 bt = (length(aSWeights) > 0.5) ? 
    boneTransform() 
    : 
    mat4(
        1., 0., 0., 0.,
        0., 1., 0., 0.,
        0., 0., 1., 0.,
        0., 0., 0., 1.
    );
  vec3 vertexPosition = (uViewModel * bt * vec4(aPosition, 1)).xyz; // Bone matrix multiplication is here!
  vec3 lightPosition = (vec4(uLightPosition, 1)).xyz;

  vEye = -vertexPosition;
  vLight = lightPosition - vertexPosition;
  vNormal = (uViewModel * vec4(aNormal, 0)).xyz;
  vTexCoord = aTexCoord;

  float d = distance(vertexPosition, lightPosition);
  vAttenuation = 1.0 / dot(uLightAttenuation, vec3(1, d, d * d));
  
  if(uDrawOutline)
  {
    vec3 normal = normalize(aNormal) * 0.1;
    vec3 pos = (vertexPosition * 2.0 + normal); // vertexPosition has to be multiplied by a large number (workaround for empty space)
    gl_Position = uProjection * vec4(pos, 1);
  }
  else
  {
    gl_Position = uProjection * vec4(vertexPosition, 1);
  }
}
`;

const fragment = /*glsl*/`#version 300 es
precision highp float;

uniform highp sampler2D uTexture;

uniform bool uUseLight;
uniform bool uDrawOutline;

uniform vec3 uLightColor;
uniform float uAmbient;
uniform float uDiffuse;
uniform float uSpecular;
uniform float uShininess;

uniform vec4 uColor;

in vec3 vEye;
in vec3 vLight;
in vec3 vNormal;
in vec2 vTexCoord;
in float vAttenuation;

out vec4 oColor;


void main()
{
  vec4 light = vec4(1, 1, 1, 1);
  if(uUseLight)
  {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(vLight);
    vec3 E = normalize(vEye);
    vec3 R = normalize(reflect(-L, N));

    float phong = pow(max(0.0, dot(E, R)), uShininess);

    float ambient = uAmbient;

    // Diffuse smooth calc
    float diffuse = dot(vNormal, vLight);
    float delta = fwidth(diffuse) * 5.0;
    float diffuseSmooth = smoothstep(0.0, delta, diffuse);

    float specular = uSpecular * phong;

    vec3 lightVec = (ambient + diffuseSmooth + specular) * vAttenuation * uLightColor;
    light = vec4(lightVec, 1);
  }

  if(uDrawOutline)
  {
    oColor = vec4(0, 0, 0, 1);
  }
  else
  {
    oColor = (uColor == vec4(0, 0, 0, 0) ? texture(uTexture, vTexCoord) : uColor) * light;
  }
}
`;

export const shaders = {
    shader: { vertex, fragment }
};