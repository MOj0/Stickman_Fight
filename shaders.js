  const vertex = /*glsl*/`#version 300 es

  uniform mat4 uProjection;
  uniform mat4 uViewModel;

  uniform mat4 uBones[42];

  uniform float uAmbient;
  uniform float uDiffuse;
  uniform float uSpecular;

  uniform float uShininess;
  uniform vec3 uLightPosition;
  uniform vec3 uLightColor;
  uniform vec3 uLightAttenuation;

  layout (location = 0) in vec3 aPosition;
  layout (location = 1) in vec3 aNormal;
  layout (location = 2) in vec2 aTexCoord;

  layout (location = 3) in highp vec2 aSIndices;
  layout (location = 4) in highp vec2 aSWeights;

  out vec3 vLight;
  out vec2 vTexCoord;

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
    vec3 lightPosition = (uViewModel * vec4(uLightPosition, 1)).xyz;
    float d = distance(vertexPosition, lightPosition);
    float attenuation = 1.0 / dot(uLightAttenuation, vec3(1, d, d * d));

    vec3 N = (uViewModel * vec4(aNormal, 0)).xyz;
    vec3 L = normalize(lightPosition - vertexPosition);
    vec3 E = normalize(-vertexPosition);
    vec3 R = normalize(reflect(-L, N));

    float lambert = max(0.0, dot(L, N));
    float phong = pow(max(0.0, dot(E, R)), uShininess);

    float ambient = uAmbient;
    float diffuse = uDiffuse * lambert;
    float specular = uSpecular * phong;

    vLight = ((ambient + diffuse + specular) * attenuation) * uLightColor;
    vTexCoord = aTexCoord;

    gl_Position = uProjection * vec4(vertexPosition, 1);
  }
  `;

  const fragment = /*glsl*/`#version 300 es

  precision mediump float;

  uniform mediump sampler2D uTexture;
  uniform vec4 uColor;

  in vec2 vTexCoord;
  in vec3 vLight;

  out vec4 oColor;

  void main() {
    vec4 light = vec4(vLight, 1);
    if(light[0] <= 0.2 && light[1] <= 0.2 && light[2] <= 0.2) // TODO: Improve?
    {
      light = vec4(0.5, 0.5, 0.5, 1);
    }

    oColor = (uColor == vec4(0, 0, 0, 0) ? texture(uTexture, vTexCoord) : uColor) * light;
  }
  `;

  export const shaders = {
      shader: { vertex, fragment }
  };