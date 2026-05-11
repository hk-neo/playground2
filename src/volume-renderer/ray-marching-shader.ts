import type { ShaderSource } from '../shared/types/rendering';

/** Ray Marching 셰이더 로직 */
export class RayMarchingShader {
  private stepSize = 0.005;
  private earlyRayTermination = 0.95;

  getVertexShader(): string {
    return `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;

uniform mat4 uMVP;

out vec3 vPosition;

void main() {
  vPosition = aPosition;
  gl_Position = uMVP * vec4(aPosition, 1.0);
}
`;
  }

  getFragmentShader(): string {
    return `#version 300 es
precision highp float;

in vec3 vPosition;

uniform sampler2D uBackFace;
uniform sampler3D uVolume;
uniform sampler2D uTransferFunction;
uniform vec2 uScreenSize;
uniform float uStepSize;
uniform float uEarlyRayTermination;

out vec4 fragColor;

void main() {
  vec2 texCoord = gl_FragCoord.xy / uScreenSize;
  vec3 backPos = texture(uBackFace, texCoord).rgb;
  vec3 frontPos = vPosition;

  vec3 dir = backPos - frontPos;
  float len = length(dir);
  if (len < 0.001) {
    fragColor = vec4(0.0);
    return;
  }
  dir = normalize(dir);

  float stepSize = uStepSize;
  vec3 step = dir * stepSize;

  vec4 accum = vec4(0.0);
  vec3 pos = frontPos;

  for (float t = 0.0; t < len; t += stepSize) {
    float density = texture(uVolume, pos).r;
    float normDensity = (density + 1024.0) / 5119.0;
    normDensity = clamp(normDensity, 0.0, 1.0);

    vec4 tfColor = texture(uTransferFunction, vec2(normDensity, 0.5));

    accum.rgb += tfColor.rgb * tfColor.a * (1.0 - accum.a);
    accum.a += tfColor.a * (1.0 - accum.a);

    if (accum.a > uEarlyRayTermination) break;

    pos += step;
  }

  fragColor = accum;
}
`;
  }

  getShaderSource(): ShaderSource {
    return {
      vertex: this.getVertexShader(),
      fragment: this.getFragmentShader(),
    };
  }

  getBackFaceVertexShader(): string {
    return `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;

uniform mat4 uMVP;

out vec3 vPosition;

void main() {
  vPosition = aPosition * 0.5 + 0.5;
  gl_Position = uMVP * vec4(aPosition, 1.0);
}
`;
  }

  getBackFaceFragmentShader(): string {
    return `#version 300 es
precision highp float;

in vec3 vPosition;

out vec4 fragColor;

void main() {
  fragColor = vec4(vPosition, 1.0);
}
`;
  }

  setStepSize(size: number): void {
    if (size <= 0 || size > 1) throw new Error('Step size must be between 0 and 1');
    this.stepSize = size;
  }

  setEarlyRayTermination(opacity: number): void {
    if (opacity <= 0 || opacity > 1) throw new Error('Early ray termination must be between 0 and 1');
    this.earlyRayTermination = opacity;
  }

  get stepSizeValue(): number { return this.stepSize; }
  get earlyRayTerminationValue(): number { return this.earlyRayTermination; }
}
