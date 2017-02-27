module.exports.sdf_union_round = `
  float sdf_union_round ( float a, float b, float r ) {
    vec2 u = max(vec2(r - a,r - b), vec2(0));

    return max(r, min (a, b)) - length(u);
  }
`

module.exports.sdf_difference_round = `
  float sdf_difference_round ( float a, float b, float r ) {
    vec2 u = max(vec2(r + a,r + -b), vec2(0));

    return min(-r, max (a, -b)) + length(u);
  }
`
