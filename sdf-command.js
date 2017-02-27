module.exports = function (regl, { vertexBuffer, sdfSrc, sdfCall, opSrc, opCall }) {
  return regl({
    vert: `
      attribute vec4 pos;

      uniform mat4 transform_matrix;

      void main () {
        gl_Position = transform_matrix * pos;
      } 
    `,
    frag: `
      precision mediump float;

      uniform sampler2D from;
      uniform vec2 viewport;
      uniform vec2 center;
      uniform float radius;

      ${ sdfSrc }
      ${ opSrc }

      void main () {
        vec2 p_texture = gl_FragCoord.xy / viewport;
        vec2 p_screen = 2. * p_texture - 1.;
        float f = texture2D(from, p_texture).a;
        float t = ${ sdfCall };
        float d = ${ opCall };

        gl_FragColor = vec4(0, 0, 0, d);
      }
    `,
    attributes: {
      pos: vertexBuffer
    },
    count: 6,
    uniforms: {
      viewport: ({ viewportWidth: w, viewportHeight: h }) => [ w, h ],
      from: regl.prop('from'),
      radius: regl.prop('radius'),
      center: regl.prop('center'),
      transform_matrix: regl.prop('transformMatrix')
    },
    depth: {
      enable: false 
    },
    blend: {
      enable: false
    },
    framebuffer: regl.prop('to')
  })
}
