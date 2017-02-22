const mat4 = require('gl-mat4')
const vec3 = require('gl-vec3')
const quat = require('gl-quat')
const regl = require('regl')({ 
  extensions: [ 'OES_texture_float' ] 
})
const gl = regl._gl
const React = require('react')
const DOM = require('react-dom')
const UI_EL = document.createElement('div')
const BIG_TRIANGLE = regl.buffer([ 
  -4, -4,
  0, 4,
  4, -4 
])
const FULL_SCREEN_QUAD = regl.buffer([
  1,  1,
  -1, 1,
  1, -1,
  -1, 1,
  -1, -1,
  1, -1
])
const { min, max, abs, pow, sin, cos, PI } = Math

const evaluate = regl({
  vert: `
    attribute vec2 pos;

    void main () {
      gl_Position = vec4(pos, 0, 1); 
    } 
  `,
  frag: `
    precision mediump float;

    uniform vec2 viewport; 

    float sdf_circle ( vec2 p, float r ) {
      return length(p) - r; 
    }

    float sdf_union ( float a, float b ) {
      return min(a, b);  
    }

    float sdf_scene ( vec2 p ) {
      return sdf_union(
        sdf_circle(p, .3),
        sdf_circle(p - .2, .3));
    }

    void main () {
      vec2 p = 2. * gl_FragCoord.xy / viewport - 1.;
      float d = sdf_scene(p);

      gl_FragColor = vec4(0, 0, 0, d);
    }
  `,
  attributes: {
    pos: BIG_TRIANGLE
  },
  uniforms: {
    viewport: ({ viewportWidth: w, viewportHeight: h }) => [ w, h ]
  },
  count: 3,
  framebuffer: regl.prop('framebuffer')
})

const render = regl({
  vert: `
    attribute vec2 pos;

    uniform mat4 mvp_matrix;

    varying vec2 coord;

    void main () {
      coord = pos;
      gl_Position = mvp_matrix * vec4(pos - .5, 0, 1);
    } 
  `,
  frag: `
    precision mediump float;

    uniform sampler2D model;
    uniform vec2 viewport; 
    uniform vec4 color;
    uniform float border_size;

    varying vec2 coord;

    const vec4 BORDER_COLOR = vec4(0, 0, 0, 1);

    float scene_smooth (vec2 p, float r) {
      float accum = texture2D(model, p).a;

      accum += texture2D(model, p + vec2(0.0, r)).a;
      accum += texture2D(model, p + vec2(0.0, -r)).a;
      accum += texture2D(model, p + vec2(r, 0.0)).a;
      accum += texture2D(model, p + vec2(-r, 0.0)).a;
      return accum / 5.0;
    }

    void main () {
      float d = texture2D(model, coord).a;
      float v = step(0., -d);
      vec4 c = vec4(.5, .5, .5, 1.);

      c = mix(color, c, step(0., d));
      c = mix(c, BORDER_COLOR, step(-border_size, d));
      c.a *= v;
      clamp(c, 0., 1.);

      gl_FragColor = c;
    } 
  `,
  attributes: {
    pos: FULL_SCREEN_QUAD
  },
  uniforms: {
    viewport: ({ viewportWidth: w, viewportHeight: h }) => [ w, h ],
    model: regl.prop('model'),
    color: regl.prop('entity.color'),
    border_size: regl.prop('borderSize'),
    mvp_matrix: regl.prop('entity.matrix')
  },
  count: 6,
  blend: {
    enable: true,
    func: {
      srcRGB: 'src alpha',
      srcAlpha: 1,
      dstRGB: 'one minus src alpha',
      dstAlpha: 1
    },
    color: [ 0, 0, 0, 0 ]
  },
  depth: {
    enable: false 
  }
})

class TableInput extends React.Component {
  render() {
    const { before, sliderProps, after } = this.props
    const input = React.DOM.input(sliderProps)

    return (
      <tr>
        <td>{ before }</td> 
        <td>{ input }</td>
        <td>{ after }</td>
      </tr> 
    ) 
  }
}

class UI extends React.Component {
  render() {
    const { settings } = this.props
    const gridProps = {
      value: settings.gridPower,
      type: 'range',
      min: 4,
      max: 10,
      step: 1,
      onChange: updateGridPower
    }
    const borderProps = {
      value: settings.borderSize,
      type: 'range',
      min: 0.0,
      max: 0.1,
      step: 0.01,
      onChange: updateBorderSize
    }
    const countProps = {
      value: settings.count,
      type: 'range',
      min: 0,
      max: TOTAL_ENTITIES,
      step: 1,
      onChange: updateCount
    }

    return (
      <table>
        <tbody>
          <TableInput sliderProps={ gridProps } before="Grid Power" after={ Math.pow(2, settings.gridPower) } />
          <TableInput sliderProps={ borderProps } before="Border Size" after={ settings.borderSize } />
          <TableInput sliderProps={ countProps } before="Count" after={ settings.count } />
        </tbody>
      </table>
    )
  }
}

function updateGridPower ( e ) {
  const val = e.target.value
  const width = height = pow(2, val)
  const colorType = 'float'

  settings.gridPower = val
  framebuffer({ width, height, colorType })
}

function updateBorderSize ( e ) {
  settings.borderSize = Number(e.target.value)
}

function updateCount ( e ) {
  settings.count = Number(e.target.value)
}

function Entity ( x, y, color ) {
  this.position = vec3.fromValues(x, y, 0)
  this.rotation = quat.create()
  this.matrix = mat4.create()
  this.color = color
}

function Camera (x, y) {
  this.position = vec3.fromValues(x, y, 0)
  this.rotation = quat.create()
  this.viewMatrix = mat4.create()
  this.projectionMatrix = mat4.create()
  this.matrix = mat4.create()
}

const TOTAL_ENTITIES = 32
const entities = []
const camera = new Camera(0, 0)

for ( var i = 0, a = 2 * PI / TOTAL_ENTITIES, x, y; i < TOTAL_ENTITIES; i++ ) {
  entities.push(new Entity(0, 0, [ i % 1, i % 2, i % 3, .25 ]))
}

const settings = {
  gridPower: 10,
  borderSize: 0.02,
  count: 16
}

const framebuffer = regl.framebuffer({
  width: pow(2, settings.gridPower),
  height: pow(2, settings.gridPower),
  colorType: 'float'
})

UI_EL.style.position = 'fixed'
UI_EL.style.backgroundColor = 'none'
document.body.appendChild(UI_EL)
document.body.addEventListener('keydown', function ({ keyCode }) {
  switch ( keyCode ) {
    case 87: camera.position[1] += .1; break
    case 65: camera.position[0] -= .1; break
    case 83: camera.position[1] -= .1; break
    case 68: camera.position[0] += .1; break
  }
})

regl.frame(({ tick, viewportWidth, viewportHeight }) => {
  const rate = tick / 100
  const aperatureSize = max(abs(sin(rate) * 4), 1)
  const w = aperatureSize
  const h = viewportHeight / viewportWidth * w
  const borderSize = settings.borderSize
  const model = framebuffer

  regl.clear({
    depth: true,
    color: [ 0, 0, 0, 0]
  })

  mat4.fromRotationTranslation(camera.viewMatrix, camera.rotation, camera.position)
  mat4.invert(camera.viewMatrix, camera.viewMatrix)
  mat4.ortho(camera.projectionMatrix, -w, w, -h, h, 0, 1) 
  mat4.multiply(camera.matrix, camera.projectionMatrix, camera.viewMatrix)

  evaluate({ framebuffer })
  
  for ( var i = 0, entity; i < settings.count; i++ ) {
    entity = entities[i] 
    entity.position[i % 3] = sin(tick / i) 
    entity.position[i % 2] = -sin(tick / i)
    entity.position[i % 2] = sin(tick / i)
    entity.position[1 % 3] = -sin(tick / i)

    quat.rotateZ(entity.rotation, entity.rotation, sin(tick / 100))
    mat4.fromRotationTranslation(entity.matrix, entity.rotation, entity.position)
    mat4.multiply(entity.matrix, camera.matrix, entity.matrix)
    render({ borderSize, model, entity, camera })
  }
  DOM.render(<UI settings={ settings } />, UI_EL)
})
