import _ from 'lodash'

export function lerp(a, b, t) {
  return a * (1 - t) + b * t
}

export function distanceSq(p, q){
  let x = p.x - q.x
  let y = p.y - q.y
  return x*x + y*y
}

export function distance(p, q){
  return Math.sqrt(distanceSq(p, q))
}

export function getCentroid( coords = [], weights = [] ){
  let x = 0
  let y = 0
  let l = coords.length
  let totalWeight = 0

  for (let i = 0; i < l; i++){
    let w = weights ? weights[i] : 1
    let p = coords[i]
    x += p.x * w
    y += p.y * w
    totalWeight += w
  }

  x /= totalWeight
  y /= totalWeight

  return {x, y}
}

export function getRandomPoints(n, width, height){
  return _.times(n).map(() => {
    let x = Math.random() * width
    let y = Math.random() * height
    return { x, y }
  })
}

export function RunningStatistics( initialData = [] ){
  let m = 0
  let s = 0
  let n = 0
  let _max = null
  let _min = null

  // Push a value to a running average calculation.
  // see [http://www.johndcook.com/blog/standard_deviation]
  // Note: variance can be calculated from the "s" value by multiplying it by `1/(n-1)`
  function push(v){
    n++
    let x = v - m

    // Mk = Mk-1 + (xk – Mk-1)/k
    // Sk = Sk-1 + (xk – Mk-1)*(xk – Mk).
    m += x / n
    s += x * (v - m)

    // max / min
    _max = Math.max(v, _max)
    _min = Math.min(v, _min)
  }

  function mean(){
    return m
  }

  function variance(){
    return s/(n-1)
  }

  function deviation(){
    return Math.sqrt(variance())
  }

  function max(){ return _max }
  function min(){ return _min }

  for ( let i = 0, l = initialData.length; i < l; i++ ){
    push(initialData[i])
  }

  return {
    mean
    , variance
    , deviation
    , max
    , min
    , push
  }
}

export function rndSimpleGaussian(mean = 0, sigma = 1){
  let g = Math.random() + Math.random() + Math.random()
  return 2 * sigma * (g - 1) + mean - 3
}
