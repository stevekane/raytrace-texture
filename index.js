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
      vec2 p = gl_FragCoord.xy / viewport - .5;
      float d = sdf_scene(p);
      float v = abs(d < 0. ? 1. : 0.);

      gl_FragColor = vec4(0, 0, 0, v);
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

    void main () {
      gl_Position = vec4(pos, 0, 1); 
    } 
  `,
  frag: `
    precision mediump float;

    uniform sampler2D model;
    uniform vec2 viewport; 
    uniform vec4 color;
    uniform mat4 model_matrix;
    uniform mat4 view_matrix;
    uniform mat4 projection_matrix;

    vec2 map ( float f1, float f2, float t1, float t2, vec2 v ) {
      return t1 + v / ( f2 - f1 ) * ( t2 - t1 ); 
    }

    void main () {
      vec2 fc = map(0., 1., -1., 1., gl_FragCoord.xy / viewport);
      fc.y = -fc.y; // flip y-axis: textures read the same as screen coords
      vec4 frag_coord = vec4(fc, 0, 1);
      vec4 cam_coord = model_matrix * view_matrix * projection_matrix * frag_coord;
      vec4 cell = texture2D(model, cam_coord.xy + .5);

      gl_FragColor = color;
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

class UI extends React.Component {
  render() {
    const { settings } = this.props
    const props = {
      value: settings.gridSize,
      type: 'range',
      min: 4,
      max: 10,
      step: 1,
      onChange: updateGridSize
    }

    return (
      <table>
        <tbody>
          <tr>
            <td>
              Grid Power
            </td> 
            <td>
              <input { ...props }/>
            </td> 
            <td>
              2<sup>{ settings.gridSize }</sup>(= { Math.pow(2, settings.gridSize)})
            </td>
          </tr>
        </tbody>
      </table>
    )
  }
}

function updateGridSize ( e ) {
  const val = e.target.value
  const width = height = pow(2, val)

  settings.gridSize = val
  framebuffer({ width, height })
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
  gridSize: 8
}

const framebuffer = regl.framebuffer({
  width: pow(2, settings.gridSize),
  height: pow(2, settings.gridSize),
  colorType: 'float'
})

document.body.appendChild(UI_EL)
document.body.addEventListener('keydown', function ({ keyCode }) {
  switch ( keyCode ) {
    case 87: camera.position[1] += .1; break
    case 65: camera.position[0] += .1; break
    case 83: camera.position[1] -= .1; break
    case 68: camera.position[0] -= .1; break
  }
})
UI_EL.style.position = 'fixed'
UI_EL.style.backgroundColor = 'none'

regl.frame(({ tick, viewportWidth, viewportHeight }) => {
  const rate = tick / 100
  const aperatureSize = max(abs(sin(rate) * 4), 1)
  const w = aperatureSize
  const h = viewportHeight / viewportWidth * aperatureSize

  regl.clear({
    depth: true,
    color: [ 0, 0, 0, 0]
  })
  evaluate({ framebuffer })
  mat4.fromRotationTranslation(camera.viewMatrix, camera.rotation, camera.position)
  mat4.invert(camera.viewMatrix, camera.viewMatrix)
  mat4.ortho(camera.projectionMatrix, -w, w, -h, h, 0, 1) 
  mat4.invert(camera.projectionMatrix, camera.projectionMatrix)
  for ( var i = 0, entity; i < entities.length; i++ ) {
    entity = entities[i] 
    mat4.fromRotationTranslation(entity.matrix, entity.rotation, entity.position)
    render({ model: framebuffer, entity, camera }) 
  }
  DOM.render(<UI settings={ settings } />, UI_EL)
})
