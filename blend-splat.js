const regl = require('regl')({ 
  extensions: [ 'OES_texture_float', 'WEBGL_draw_buffers' ] 
})
const mat4 = require('gl-mat4')
const MouseSignal = require('mouse-signal')
const KeyboardSignal = require('keyboard-signal')
const SDFCommand = require('./sdf-command')
const BigTrinagle = require('big-triangle')
const FullScreenQuad = require('full-screen-quad')
const { sdf_union_round, sdf_difference_round } = require('./sdf-operations')
const { sdf_circle } = require('./sdf-primitives')
const { pow, abs, sin, cos, random } = Math
const rand = _ => random() * 2 - 1

/*
Color each sdf -- each SDF is spawned with a "color" paramater ( rgb only for now )
Color the field ?  
  Color would itself be a block primitive.  This probably would not
  compose well for per-sdf animation but would be nice if the field of SDFs were fixed?
Color SDFs AFTER they have been added?  Presumably this would need to uniformly modify 
the affected SDFs entirely?
*/

const BIG_TRIANGLE = regl.buffer(new BigTrinagle(4))
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
const subtractSDFSphere = SDFCommand(regl, {
  vertexBuffer: FULL_SCREEN_QUAD,
  sdfSrc: sdf_circle,
  opSrc: sdf_difference_round,
  sdfCall: 'sdf_circle(p_screen - center, radius)',
  opCall: 'sdf_difference_round(f, t, 0.04)'
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
    attachments: regl.prop('attachments'),
    transform_matrix: regl.prop('transformMatrix')
  },
  depth: { 
    enable: false
  },
  blend: {
    enable: false
  },
  framebuffer: regl.prop('dst')
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
const COUNT = 1000

// for ( var i = 0, add; i <= COUNT; i++ ) {
//   add = random() < 0.5
//   objects.push({ 
//     position: [ rand(), rand() ], 
//     velocity: !add ? [ rand() / 100, rand() / 100 ] : [ 0, 0 ],
//     radius: 20 / COUNT * random(),
//     add: add
//   })
// }

const evalProps = {
  from: accumulator,
  to: null,
  center: [ 0, 0 ],
  radius: 0,
  transformMatrix: mat4.create()
}
const copyProps = {
  attachments: [ null, null ],
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
      velocity: [ 0, 0 ],
      radius: .01,
      add: !kbs.SHIFT.mode.DOWN
    })
  }

  for ( var i = 0, object; i < objects.length; i++) {
    src = targets[i % targets.length]
    object = objects[i]
    object.position[0] += object.velocity[0]
    object.position[1] += object.velocity[1]
    center[0] = object.position[0]
    center[1] = object.position[1]
    evalProps.radius = object.radius
    evalProps.to = src 
    mat4.identity(matrix)
    mat4.translate(matrix, matrix, [ center[0], center[1], 0 ])
    mat4.scale(matrix, matrix, [ object.radius * 10, object.radius * 10, 1 ])  
    object.add ? addSDFSphere(evalProps) : subtractSDFSphere(evalProps)
    copyProps.attachments[0] = src.color[0]
    copyProps.attachments[1] = src.color[1]
    mat4.copy(copyProps.transformMatrix, matrix)
    copy(copyProps)
  }
  render(renderProps)
  clearProps.framebuffer = accumulator 
  regl.clear(clearProps)
}

regl.frame(update)
