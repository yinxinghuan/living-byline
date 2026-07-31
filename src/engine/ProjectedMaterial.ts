import * as THREE from 'three'

export type ProjectionUniforms = {
  projectorProjection: { value: THREE.Matrix4 }
  projectionView: { value: THREE.Matrix4 }
  projectorPosition: { value: THREE.Vector3 }
  pageTexture: { value: THREE.Texture }
  reveal: { value: number }
  resolve: { value: number }
  boost: { value: number }
  time: { value: number }
  accent: { value: THREE.Color }
}

export function createProjectionMaterial(
  texture: THREE.Texture,
  color = new THREE.Color('#10241e'),
) {
  const uniforms: ProjectionUniforms = {
    projectorProjection: { value: new THREE.Matrix4() },
    projectionView: { value: new THREE.Matrix4() },
    projectorPosition: { value: new THREE.Vector3() },
    pageTexture: { value: texture },
    reveal: { value: 0.14 },
    resolve: { value: 0 },
    boost: { value: 0 },
    time: { value: 0 },
    accent: { value: new THREE.Color('#9b553d') },
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform mat4 projectorProjection;
      uniform mat4 projectionView;
      uniform float boost;
      uniform float time;
      varying vec4 vProject;
      varying vec3 vNormalWorld;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        p += normal * (sin(position.y * 3.2 + time * 1.4) * 0.028 * boost);
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        vProject = projectorProjection * projectionView * world;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D pageTexture;
      uniform vec3 projectorPosition;
      uniform float reveal;
      uniform float resolve;
      uniform float boost;
      uniform float time;
      uniform vec3 accent;
      varying vec4 vProject;
      varying vec3 vNormalWorld;
      varying vec3 vWorld;
      void main() {
        vec3 ndc = vProject.xyz / vProject.w;
        vec2 uv = ndc.xy * 0.5 + 0.5;
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        vec4 page = texture2D(pageTexture, uv);
        vec3 toProjector = normalize(projectorPosition - vWorld);
        float facing = smoothstep(0.08, 0.34, dot(normalize(vNormalWorld), toProjector));
        float edge = pow(1.0 - abs(dot(normalize(vNormalWorld), normalize(cameraPosition - vWorld))), 2.2);
        vec3 base = vec3(${color.r.toFixed(4)}, ${color.g.toFixed(4)}, ${color.b.toFixed(4)});
        float resolvedFacing = mix(facing, 1.0, smoothstep(0.72, 0.98, resolve));
        float projection = inside * resolvedFacing * (0.08 + reveal * 0.92);
        float light = 0.62 + max(dot(normalize(vNormalWorld), normalize(vec3(-0.4, 0.8, 0.65))), 0.0) * 0.42;
        vec3 shadedBase = base * light;
        shadedBase += accent * edge * (0.07 + boost * 0.12);
        vec3 ink = mix(shadedBase, page.rgb, projection);
        gl_FragColor = vec4(ink, 1.0);
      }
    `,
  })
  return { material, uniforms }
}
