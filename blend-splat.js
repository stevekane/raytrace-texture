const regl = require('regl')({ extensions: [ 'OES_texture_float' ] })
const { pow, abs, sin, cos } = Math
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

    void main () {
      gl_Position = pos;
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
    center: regl.prop('center')
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
      float d_out = abs(pow(d, .1));

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
  count: 3
})

const objects = []

for ( var i = -1; i <= 1; i++ ) {
  objects.push({ center: [ i * .6, 0 ], radius: 0.3 })
}

// objects.push({ center: [ 0.4, 0 ], radius: 0.3 })

function update ({ tick, time }) {
  var center = [ 0, 0 ]
  var to = framebuffers[0]
  var from = framebuffers[1]
  var tmp
  var radius = 0.5

  for ( var i = 0, object; i < objects.length; i++) {
    tmp = to
    to = from
    from = tmp
    object = objects[i]
    center[i % 2] = object.center[i % 2] + sin(time * 2) * .5
    sdfSphere({ from, to, center, radius: object.radius })
  }
  render({ from: to })
  regl.clear({ color: [ 0, 0, 0, 10000 ], framebuffer: to })
  regl.clear({ color: [ 0, 0, 0, 10000 ], framebuffer: from })
}

regl.frame(update)
