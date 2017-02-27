module.exports.sdf_circle = `
  float sdf_circle ( vec2 p, float r ) {
    return length(p) - r; 
  }
`
