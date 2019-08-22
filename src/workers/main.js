import { transfer } from 'comlink'
import _ from 'lodash'
import chroma from 'chroma-js'
const colorScale = chroma.scale('YlGnBu')

function distanceSq(p, q){
  let x = p.x - q.x
  let y = p.y - q.y
  return x*x + y*y
}

function distance(p, q){
  return Math.sqrt(distanceSq(p, q))
}

function setPixel(ctx, x, y, color = 'white'){
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, 1)
}

function drawCircle(ctx, {x, y}, radius, color = 'white'){
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, 2 * Math.PI, false)
  ctx.fillStyle = color
  ctx.fill()
}

function getNearestSeed(p, seeds = []){
  return _.minBy(seeds, s => distance(p, s))
}

function calcPhi(p, seed, K){
  let d2 = distanceSq(p, seed)
  return d2 + Math.sqrt(d2) - K
}

function scale(min, max, z){
  return (z - min) / (max - min)
}

function drawRegion( ctx, region ){
  const l = region.length
  let min = region[0].phi
  let max = region[l - 1].phi

  for (let i = 0; i < l; i++){
    let entry = region[i]
    let alpha = scale(min, max, entry.phi)
    // console.log(alpha)
    setPixel(ctx, entry.p.x, entry.p.y, entry.color.alpha(alpha).css())
  }
}

function draw(ctx, seeds = []){
  const canvas = ctx.canvas
  const width = canvas.width
  const height = canvas.height
  const len = seeds.length
  const colors = colorScale.colors(len, 'rgba')

  ctx.clearRect(0, 0, width, height)

  let regions = seeds.map(() => [])

  for (let y = 0; y < height; y++){
    for (let x = 0; x < width; x++){
      let p = {x, y}
      let K = _.sumBy(seeds, s => distanceSq(p, s))

      let nearest = _.minBy(seeds, s => calcPhi(p, s, K))
      let phi = calcPhi(p, nearest, K)
      let index = _.indexOf(seeds, nearest)
      let color = colors[index]
      let region = regions[index]
      let entry = { p, phi, color }
      let eidx  = _.sortedIndexBy(region, entry, 'phi')
      region.splice(eidx, 0, entry)
    }
  }

  regions.forEach( r => drawRegion(ctx, r) )

  seeds.forEach( s => {
    drawCircle(ctx, s, 5, 'red')
  })
}

export function getImageData(width, height, seeds = []){
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')

  draw(ctx, seeds)

  let data = ctx.getImageData(0, 0, width, height)
  return transfer(data, [data.data.buffer])
}
