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
const TARGET_COUNT = 32
const accumulator = regl.framebuffer({
  width: pow(2, side),
  height: pow(2, side),
  colorType: 'float'
})
const targets = []

for ( var i = 0; i < TARGET_COUNT; i++ ) {
  targets.push(regl.framebuffer({
    width: pow(2, side),
    height: pow(2, side),
    colorType: 'float'
  }))
}

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
  depth: {
    enable: false 
  },
  blend: {
    enable: false
  },
  framebuffer: regl.prop('to')
})

const copy = regl({
  vert: `
    attribute vec4 pos; 

    uniform mat4 transform_matrix;

    void main () {
      gl_Position = transform_matrix * pos;
    } 
  `,
  frag: `
    precision mediump float; 

    uniform sampler2D src;
    uniform vec2 viewport;

    void main () {
      vec2 p = gl_FragCoord.xy / viewport;

      gl_FragColor = texture2D(src, p);
    }
  `,
  attributes: {
    pos: FULL_SCREEN_QUAD
  },
  count: 6,
  uniforms: {
    viewport: ({ viewportWidth: w, viewportHeight: h }) => [ w, h ],
    src: regl.prop('src'),
    transform_matrix: regl.prop('transformMatrix')
  },
  depth: { 
    enable: false
  },
  blend: {
    enable: false
  },
  framebuffer: regl.prop('dst') // TODO: do I need to do this? can use framebuffer?
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
      float d_out = pow(clamp(d, 0., 1.), .01);

      c = mix(color, c, d_out);

      gl_FragColor = c;
    } 
  `,
  attributes: {
    pos: BIG_TRIANGLE,
  },
  count: 3,
  uniforms: {
    viewport: ({ viewportWidth: w, viewportHeight: h }) => [ w, h ],
    from: accumulator
  },
  depth: {
    enable: false 
  }
})

const objects = []
const COUNT = 100

for ( var i = -COUNT; i <= COUNT; i++ ) {
  objects.push({ center: [ i / COUNT, 0 ], radius: .03 })
}

const evalProps = {
  from: accumulator,
  to: null,
  center: [ 0, 0 ],
  radius: 0,
  transformMatrix: mat4.create()
}
const copyProps = {
  src: null,
  dst: accumulator,
  transformMatrix: mat4.create(),
}
const renderProps = {
  from: accumulator
}
const clearProps = {
  color: [ 0, 0, 0, 1000 ],
  framebuffer: null
}

function update ({ tick, time }) {
  var matrix = evalProps.transformMatrix
  var center = evalProps.center
  var src

  for ( var i = 0, object; i < objects.length; i++) {
    src = targets[i % targets.length]
    object = objects[i]
    center[0] = object.center[0]
    center[1] = object.center[1] + sin(time * i / 40)
    evalProps.radius = object.radius
    evalProps.to = src 
    mat4.identity(matrix)
    mat4.translate(matrix, matrix, [ center[0], center[1], 0 ])
    mat4.scale(matrix, matrix, [ object.radius * 6, object.radius * 6, 1 ])  
    sdfSphere(evalProps)
    copyProps.src = src
    mat4.copy(copyProps.transformMatrix, matrix)
    copy(copyProps)
  }
  render(renderProps)
  clearProps.framebuffer = accumulator 
  regl.clear(clearProps)
}

regl.frame(update)
