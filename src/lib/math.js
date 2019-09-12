
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

export function getCentroid( coords = [], weights ){
  let x = 0
  let y = 0
  let l = coords.length
  let totalWeight = 1

  for (let i = 0; i < l; i++){
    let w = weights ? weights[i] : 1
    let p = coords[i]
    x += p.x
    y += p.y
    totalWeight += w
  }

  x /= l
  y /= l

  return {x, y}
}

export function getRandomPoints(n, width, height){
  return _.times(n).map(n => {
    let x = Math.random() * width
    let y = Math.random() * height
    return { x, y }
  })
}
