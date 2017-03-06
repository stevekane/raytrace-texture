const regl = require('regl')({ 
  extensions: [ 'OES_texture_float', 'WEBGL_draw_buffers' ] 
})
const mat4 = require('gl-mat4')
const MouseSignal = require('mouse-signal')
const KeyboardSignal = require('keyboard-signal')
const SDFCommand = require('./sdf-command')
const BigTriangle = require('big-triangle')
const FullScreenQuad = require('full-screen-quad')
const { sdf_union_round, sdf_difference_round } = require('./sdf-operations')
const { sdf_circle } = require('./sdf-primitives')
const { pow, abs, sin, cos, random } = Math
const rand = _ => random() * 2 - 1

const BIG_TRIANGLE = regl.buffer(new BigTriangle(4))
const FULL_SCREEN_QUAD = regl.buffer(new FullScreenQuad(4))
const FRAMEBUFFER_POWER = 9
const TARGET_COUNT = 128
const width = height = pow(2, FRAMEBUFFER_POWER)
const accumulator = regl.framebuffer({
  colors: [
    regl.texture({
      width,
      height,
      type: 'float' 
    }),
    regl.texture({
      width,
      height,
      type: 'float'
    })
  ]
})
const targets = []

for ( var i = 0; i < TARGET_COUNT; i++ ) {
  targets.push(regl.framebuffer({
    colors: [
      regl.texture({
        width,
        height,
        colorType: 'float'
      }),
      regl.texture({
        width,
        height,
        colorType: 'float'
      })
    ]
  }))
}

const addSDFSphere = SDFCommand(regl, {
  vertexBuffer: FULL_SCREEN_QUAD,
  sdfSrc: sdf_circle,
  opSrc: sdf_union_round,
  sdfCall: 'sdf_circle(p_screen - center, radius)',
  opCall: 'sdf_union_round(f, t, 0.04)'
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
    #extension GL_EXT_draw_buffers : require

    precision mediump float; 

    uniform sampler2D attachments[2];
    uniform vec2 viewport;

    void main () {
      vec2 p = gl_FragCoord.xy / viewport;

      gl_FragData[0] = texture2D(attachments[0], p);
      gl_FragData[1] = texture2D(attachments[1], p);
    }
  `,
  attributes: {
    pos: FULL_SCREEN_QUAD 
  },
  count: 6,
  uniforms: {
    viewport: ({ viewportWidth: w, viewportHeight: h }) => [ w, h ],
    'attachments[0]': regl.prop('attachments.0'),
    'attachments[1]': regl.prop('attachments.1'),
    transform_matrix: regl.prop('transformMatrix')
  },
  depth: { enable: false },
  blend: { enable: false },
  framebuffer: regl.prop('dst')
})

const clear = regl({
  vert: `
    attribute vec4 pos;

    void main () {
      gl_Position = pos; 
    }
  `,
  frag: `
    #extension GL_EXT_draw_buffers : require 

    precision mediump float;

    uniform vec4 colors[2];

    void main () {
      gl_FragData[0] = colors[0];
      gl_FragData[1] = colors[1];
    }
  `,
  attributes: {
    pos: BIG_TRIANGLE
  },
  count: 3,
  uniforms: {
    'colors[0]': regl.prop('colors.0'),
    'colors[1]': regl.prop('colors.1')
  },
  depth: { enable: false },
  blend: { enable: false },
  framebuffer: regl.prop('framebuffer')
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

    uniform sampler2D from[2];
    uniform vec2 viewport;

    void main () {
      vec2 p = gl_FragCoord.xy / viewport;
      vec4 color = texture2D(from[1], p);
      float d = texture2D(from[0], p).a;

      gl_FragColor = d <= 0.
        ? vec4(color.rgb, 1.)
        : vec4(0, 0, 0, 0);
    } 
  `,
  attributes: {
    pos: BIG_TRIANGLE,
  },
  count: 3,
  uniforms: {
    viewport: ({ viewportWidth: w, viewportHeight: h }) => [ w, h ],
    'from[0]': regl.prop('from.0'),
    'from[1]': regl.prop('from.1')
  },
  depth: { enable: false }
})

const objects = []
const COUNT = 40

for ( var i = -COUNT; i <= COUNT; i++ ) {
  objects.push({ 
    position: [ i / COUNT, 0 ], 
    // velocity: [ rand() / 100, rand() / 100 ],
    velocity: [ 0, 0 ],
    color: [ random(), random(), random() ],
    radius: rand() / 10,
    add: true
  })
}

const evalProps = {
  from: accumulator.color,
  to: null,
  center: [ 0, 0 ],
  radius: 0,
  color: [ 0, 0, 0 ],
  transformMatrix: mat4.create()
}
const copyProps = {
  attachments: [ null, null ],
  dst: accumulator,
  transformMatrix: mat4.create(),
}
const renderProps = {
  from: accumulator.color
}
const clearProps = {
  colors: [
    [ 0, 0, 0, 1 ],
    [ 0, 0, 0, 0 ]
  ],
  framebuffer: accumulator
}
const ms = new MouseSignal(document.body)
const kbs = new KeyboardSignal(document.body)

for ( var key in ms.eventListeners ) {
  document.body.addEventListener(key, ms.eventListeners[key])
}
for ( var key in kbs.eventListeners ) {
  document.body.addEventListener(key, kbs.eventListeners[key])
}

function update ({ tick, time }) {
  var matrix = evalProps.transformMatrix
  var center = evalProps.center
  var src

  MouseSignal.update(1, ms)
  KeyboardSignal.update(1, kbs)
  if ( ms.left.mode.DOWN ) {
    const { clientWidth, clientHeight } = regl._gl.canvas
    const x = 2 * ms.current[0] / clientWidth - 1
    const y = 2 * ( 1 - ms.current[1] / clientHeight ) - 1

    objects.push({ 
      position: [ x, y ], 
      velocity: [ rand() / 100, rand() / 100 ],
      radius: .01,
      color: [ rand(), rand(), rand() ],
      add: !kbs.SHIFT.mode.DOWN
    })
  }

  // objects[1].position[0] = sin(time)
  for ( var i = 0, object; i < objects.length; i++) {
    src = targets[i % targets.length]
    object = objects[i]
    object.position[0] += object.velocity[0]
    object.position[1] += object.velocity[1]
    center[0] = object.position[0]
    center[1] = object.position[1]
    evalProps.radius = object.radius
    evalProps.color[0] = object.color[0]
    evalProps.color[1] = object.color[1]
    evalProps.color[2] = object.color[2]
    evalProps.to = src 
    mat4.identity(matrix)
    mat4.translate(matrix, matrix, [ center[0], center[1], 0 ])
    // mat4.scale(matrix, matrix, [ object.radius * 3, object.radius * 3, 1 ])  
    addSDFSphere(evalProps)
    copyProps.attachments = src.color
    copyProps.transformMatrix = matrix
    copy(copyProps)
  }
  render(renderProps)
  clear(clearProps)
}

regl.frame(update)
