const regl = require('regl')({ extensions: [ 'OES_texture_float' ] })
const React = require('react')
const DOM = require('react-dom')
const UI_EL = document.createElement('div')
const BIG_TRIANGLE = regl.buffer([ [ -4, -4 ],  [ 0, 4 ], [ 4, -4 ] ])
const { pow } = Math
const compose = (f1, f2) => x => f1(f2(x))
const log = console.log.bind(console)
const targetValue = e => e.target.value

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
        sdf_circle(p - vec2(.2), .2));
    }

    void main () {
      vec2 p = gl_FragCoord.xy / viewport - .5;
      float d = sdf_scene(p);
      float v = abs(d < 0. ? 1. : 0.);

      gl_FragColor = vec4(v, 0, 0, v);
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
    uniform vec2 position;

    void main () {
      vec2 coord = gl_FragCoord.xy / viewport - position;

      gl_FragColor = texture2D(model, coord);
    } 
  `,
  attributes: {
    pos: BIG_TRIANGLE
  },
  uniforms: {
    viewport: ({ viewportWidth: w, viewportHeight: h }) => [ w, h ],
    model: regl.prop('model'),
    position: regl.prop('position')
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
  }
})

class UI extends React.Component {
  render() {
    const { settings } = this.props
    const props = {
      value: settings.gridSize,
      type: 'range',
      min: 1,
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
              2
              <sup>
                { settings.gridSize }
              </sup>
            </td>
          </tr>
        </tbody>
      </table>
    )
  }
}

const settings = {
  gridSize: 8
}

const framebuffer = regl.framebuffer({
  width: settings.gridSize,
  height: settings.gridSize,
  colorType: 'float'
})

function updateGridSize ( e ) {
  const val = e.target.value
  const width = height = pow(2, val)

  settings.gridSize = val
  framebuffer({ width, height })
}

document.body.appendChild(UI_EL)
UI_EL.style.position = 'fixed'
UI_EL.style.backgroundColor = 'none'

regl.frame(({ tick }) => {
  const rate = tick / 100

  regl.clear({
    depth: true,
    color: [ 0, 0, 0, 0]
  })
  evaluate({ framebuffer })
  render([ 
    { model: framebuffer, position: [ Math.sin(rate), 0 ] },
    { model: framebuffer, position: [ 0, Math.sin(rate) ] },
  ])
  DOM.render(<UI settings={ settings }/>, UI_EL)
})
