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
      #extension GL_EXT_draw_buffers : enable

      precision mediump float;

      uniform sampler2D from[2];
      uniform vec2 viewport;
      uniform vec2 center;
      uniform vec3 color;
      uniform float radius;

      ${ sdfSrc }
      ${ opSrc }

      vec4 blend ( vec4 c1, vec4 c2 ) {
        vec4 c = c1 * c1.a + c2 * ( 1. - c1.a );

        c.a = c1.a + c2.a;
        return clamp(c, 0., 1.);
      }

      void main () {
        float t = 0.01; //Thickness of edge
        float r = 0.04; // Radius for smoothing
        float f = 2.; // Radial falloff power
        vec2 p_texture = gl_FragCoord.xy / viewport;
        vec2 p_screen = 2. * p_texture - 1.;
        vec4 old_color = texture2D(from[1], p_texture);
        float old_d = texture2D(from[0], p_texture).a;
        float new_d = sdf_circle(p_screen - center, radius);
        float new_i = new_d < t ? 1. : abs(t / pow(new_d, f));
        float d = sdf_union_round(old_d, new_d, r);
        vec4 new_color = vec4(color, new_i);
        vec4 c = blend(old_color, new_color);

        gl_FragData[0] = vec4(0, 0, 0, d);
        gl_FragData[1] = c;
      }
    `,
    attributes: {
      pos: vertexBuffer
    },
    count: 6,
    uniforms: {
      viewport: ({ viewportWidth: w, viewportHeight: h }) => [ w, h ],
      'from[0]': regl.prop('from.0'),
      'from[1]': regl.prop('from.1'),
      radius: regl.prop('radius'),
      center: regl.prop('center'),
      color: regl.prop('color'),
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
