const regl = require('regl')({ extensions: [ 'OES_texture_float' ] })
const { pow, abs, sin, cos } = Math

const BIG_TRIANGLE = regl.buffer([ 
  -4, -4, 0, 1,
  0, 4, 0, 1,
  4, -4, 0, 1
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

    float sdf_union ( float a, float b ) {
      return min(a, b);  
    }

    void main () {
      vec2 p_texture = gl_FragCoord.xy / viewport;
      vec2 p_screen = 2. * p_texture - 1.;
      float f = texture2D(from, p_texture).a;
      float t = sdf_circle(p_screen - center, radius);
      float d = sdf_union(f, t);

      gl_FragColor = vec4(0, 0, 0, d);
    }
  `,
  attributes: {
    pos: BIG_TRIANGLE 
  },
  count: 3,
  uniforms: {
    viewport: ({ viewportWidth: w, viewportHeight: h }) => [ w, h ],
    from: regl.prop('from'),
    radius: regl.prop('radius'),
    center: regl.prop('center')
  },
  framebuffer: regl.prop('to'),
  depth: {
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
      vec4 c = vec4(0, 0, 0, 0);
      float d = texture2D(from, p).a;

      // object color
      c = mix(vec4(1, 0, 0, 1), c, step(0., d));

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

const objects = [
  { center: [ 0, 0 ], radius: .1 },
  { center: [ 1, 0 ], radius: .2 } 
]

function update ({ pixelRatio, viewportWidth, viewportHeight, tick }) {
  var index = 0
  var center = [ 0, 0 ]
  var from
  var to
  var radius = 0.5

  for ( var i = 0, object; i < objects.length; i++) {
    object = objects[i]
    // object.center[1] = sin(tick / 10)
    from = framebuffers[index]
    index = (i + 1) % 2
    to = framebuffers[index]
    sdfSphere({ from, to, center: object.center, radius: object.radius })
  }
  render({ from: to })
  regl.clear({ color: [ 0, 0, 0, 0 ], framebuffer: to })
}

regl.frame(update)
