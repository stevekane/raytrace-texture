const regl = require('regl')({ extensions: [ 'OES_texture_float' ] })
const mat4 = require('gl-mat4')
const { pow, abs, sin, cos, random } = Math
const rand = _ => (Math.random() > 0.5 ? 1 : -1) * Math.random()

const BIG_TRIANGLE = regl.buffer([ 
  -4, -4, 0, 1,
  0, 4, 0, 1,
  4, -4, 0, 1
])

const FULL_SCREEN_QUAD = regl.buffer([
  1,  1, 0, 1,
  -1, 1, 0, 1,
  1, -1, 0, 1,
  -1, 1, 0, 1,
  -1, -1, 0, 1,
  1, -1, 0, 1
])

const side = 10
const framebuffers = [ null, null ].map(function () {
  return regl.framebuffer({
    width: pow(2, side),
    height: pow(2, side),
    colorType: 'float'
  })
})

const sdfSphere = regl({
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

    float sdf_circle ( vec2 p, float r ) {
      return length(p) - r; 
    }

    float sdf_union_round ( float a, float b, float r ) {
      vec2 u = max(vec2(r - a,r - b), vec2(0));

      return max(r, min (a, b)) - length(u);
    }

    void main () {
      vec2 p_texture = gl_FragCoord.xy / viewport;
      vec2 p_screen = 2. * p_texture - 1.;
      float f = texture2D(from, p_texture).a;
      float t = sdf_circle(p_screen - center, radius);
      float d = sdf_union_round(f, t, 0.05);

      gl_FragColor = vec4(0, 0, 0, d);
    }
  `,
  attributes: {
    pos: FULL_SCREEN_QUAD
  },
  count: 6,
  uniforms: {
    viewport: ({ viewportWidth: w, viewportHeight: h }) => [ w, h ],
    from: regl.prop('from'),
    radius: regl.prop('radius'),
    center: regl.prop('center'),
    transform_matrix: regl.prop('transformMatrix')
  },
  framebuffer: regl.prop('to'),
  depth: {
    enable: false 
  },
  blend: {
    enable: false
  }
})

const render = regl({
  vert: `
    attribute vec4 pos; 

    void main () {
      gl_Position = pos;
    } 
  `,
  frag: `
    precision mediump float;

    uniform sampler2D from;
    uniform vec2 viewport;

    void main () {
      vec2 p = gl_FragCoord.xy / viewport;
      vec4 c = vec4(0, 0, 0, 1);
      vec4 color = vec4(1, 0, 0, 1);
      float d = texture2D(from, p).a;
      float d_out = pow(clamp(d, 0., 1.), .1);

      c = mix(color, c, d_out);

      gl_FragColor = c;
    } 
  `,
  attributes: {
    pos: BIG_TRIANGLE,
  },
  uniforms: {
    viewport: ({ viewportWidth: w, viewportHeight: h }) => [ w, h ],
    from: regl.prop('from')
  },
  count: 3,
  depth: {
    enable: false 
  }
})

const objects = []
const COUNT = 5

for ( var i = -COUNT; i <= COUNT; i++ ) {
  objects.push({ center: [ i / COUNT, 0 ], radius: .15 })
}

const evalProps = {
  from: null,
  to: null,
  center: [ 0, 0 ],
  radius: 0,
  transformMatrix: mat4.create()
}
const renderProps = {
  from: null
}
const clearProps = {
  color: [ 0, 0, 0, 1000 ],
  framebuffer: null
}

function update ({ tick, time }) {
  var matrix = evalProps.transformMatrix
  var center = evalProps.center
  var to = framebuffers[0]
  var from = framebuffers[1]
  var tmp

  for ( var i = 0, object; i < objects.length; i++) {
    tmp = to
    to = from
    from = tmp
    object = objects[i]
    evalProps.from = from
    evalProps.to = to
    center[0] = object.center[0]
    center[1] = object.center[1] + sin(time * i / 10)
    evalProps.radius = object.radius
    mat4.identity(matrix)
    mat4.translate(matrix, matrix, [ center[0], center[1], 0 ])
    mat4.scale(matrix, matrix, [ object.radius * 1.5, object.radius * 1.5, 1 ])  
    sdfSphere(evalProps)
    renderProps.from = to
    render(renderProps)
  }
  // renderProps.from = to
  // render(renderProps)
  clearProps.framebuffer = to
  regl.clear(clearProps)
  clearProps.framebuffer = from
  regl.clear(clearProps)
}

regl.frame(update)
