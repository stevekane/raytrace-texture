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
const BIG_TRIANGLE = regl.buffer([ [ -4, -4 ],  [ 0, 4 ], [ 4, -4 ] ])
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
      return sdf_circle(p, .3);
    }

    void main () {
      vec2 p = 2. * gl_FragCoord.xy / viewport - 1.;
      float d = sdf_scene(p);
      float v = abs(d < 0. ? 1. : 0.);

      gl_FragColor = vec4(0, 0, d, v);
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

    uniform mat4 model_matrix;
    uniform mat4 view_matrix;
    uniform mat4 projection_matrix;

    varying vec2 coord;

    void main () {
      coord = pos;
      gl_Position = projection_matrix * view_matrix * model_matrix * vec4(pos - .5, 0, 1);
    } 
  `,
  frag: `
    precision mediump float;

    uniform sampler2D model;
    uniform vec2 viewport; 
    uniform vec4 color;
    uniform float border_size;

    varying vec2 coord;

    const vec3 BORDER_COLOR = vec3(0);

    void main () {
      vec4 cell = texture2D(model, coord);

      gl_FragColor = abs(cell.b) <= border_size
        ? vec4(BORDER_COLOR, 1)
        : color;
      gl_FragColor.a *= cell.a;
    } 
  `,
  attributes: {
    pos: BIG_TRIANGLE
  },
  uniforms: {
    viewport: ({ viewportWidth: w, viewportHeight: h }) => [ w, h ],
    model: regl.prop('model'),
    color: regl.prop('entity.color'),
    border_size: regl.prop('borderSize'),
    model_matrix: regl.prop('entity.matrix'),
    view_matrix: regl.prop('camera.viewMatrix'),
    projection_matrix: regl.prop('camera.projectionMatrix')
  },
  count: 3,
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
      value: settings.gridSize,
      type: 'range',
      min: 4,
      max: 10,
      step: 1,
      onChange: updateGridSize
    }
    const borderProps = {
      value: settings.borderSize,
      type: 'range',
      min: 0.0,
      max: 0.1,
      step: 0.01,
      onChange: (e) => settings.borderSize = Number(e.target.value)
    }

    return (
      <table>
        <tbody>
          <TableInput sliderProps={ gridProps } before="Grid Power" after={ Math.pow(2, settings.gridSize) } />
          <TableInput sliderProps={ borderProps } before="Border Size" after={ settings.borderSize } />
        </tbody>
      </table>
    )
  }
}

function updateGridSize ( e ) {
  const val = e.target.value
  const width = height = pow(2, val)
  const colorType = 'float'

  settings.gridSize = val
  framebuffer({ width, height, colorType })
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
}

const TOTAL_ENTITIES = 4
const entities = []
const camera = new Camera(0, 0)

for ( var i = 0, a = 2 * PI / TOTAL_ENTITIES, x, y; i < TOTAL_ENTITIES; i++ ) {
  x = cos(i * a) * .4
  y = sin(i * a) * .4
  entities.push(new Entity(x, y, [ 1, 0, 0, .25 ]))
}
const settings = {
  gridSize: 8,
  borderSize: 0.1
}

const framebuffer = regl.framebuffer({
  width: pow(2, settings.gridSize),
  height: pow(2, settings.gridSize),
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

  regl.clear({
    depth: true,
    color: [ 0, 0, 0, 0]
  })
  mat4.fromRotationTranslation(camera.viewMatrix, camera.rotation, camera.position)
  mat4.invert(camera.viewMatrix, camera.viewMatrix)
  mat4.ortho(camera.projectionMatrix, -w, w, -h, h, 0, 1) 
  entities[0].position[0] = sin(tick / 20) 
  entities[2].position[0] = -sin(tick / 30)
  entities[1].position[1] = sin(tick / 40)
  entities[3].position[1] = -sin(tick / 50)
  evaluate({ framebuffer })
  for ( var i = 0, entity; i < entities.length; i++ ) {
    entity = entities[i] 
    if ( settings.spin ) {
      quat.rotateZ(entity.rotation, entity.rotation, 0.01)
    }
    mat4.fromRotationTranslation(entity.matrix, entity.rotation, entity.position)
    render({ 
      borderSize: settings.borderSize,
      model: framebuffer, 
      entity, 
      camera 
    }) 
  }
  DOM.render(<UI settings={ settings } />, UI_EL)
})
