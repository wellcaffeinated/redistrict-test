import { transfer } from 'comlink'
import _ from 'lodash'
import chroma from 'chroma-js'
const colorScale = chroma.scale('Paired')

function indexWithLowestValue( arr ){
  let lowestIndex = -1
  let lowestValue
  arr.forEach( (v,i) => {
    if ( lowestValue === undefined || lowestValue > v ){
      lowestValue = v
      lowestIndex = i
    }
  })
  return lowestIndex
}

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

function drawRegion( ctx, region, color ){
  const l = region.length
  let min = region[0].phi
  let max = region[l - 1].phi
  let colorScale = chroma.scale([
    color.darken(2)
    , color.darken(2).desaturate(2)
  ]).mode('lab')

  for (let i = 0; i < l; i++){
    let entry = region[i]
    let alpha = scale(min, max, entry.phi)
    let color = colorScale(alpha)
    // console.log(alpha)
    setPixel(ctx, entry.p.x, entry.p.y, color.css())
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
      let region = regions[index]
      let entry = { p, phi }
      let eidx  = _.sortedIndexBy(region, entry, 'phi')
      region.splice(eidx, 0, entry)
    }
  }

  regions.forEach( (r, i) => drawRegion(ctx, r, colors[i]) )

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

///

function getRandomPoints(n, width, height){
  return _.times(n).map(n => {
    let x = Math.random() * width
    let y = Math.random() * height
    return { x, y }
  })
}

function getRandomCensusBlocks(n, width, height){
  let cities = getRandomPoints(10, width, height)

  return getRandomPoints(n, width, height).map( position => {
    let nearest = _.minBy(cities, s => distanceSq(position, s))
    let d = distance(nearest, position)
    let min = Math.max(100, scale(width, 0, d) * 5000)
    let max = min + 1000
    let population = _.random(min|0, max|0)

    return {
      position
      , population
    }
  })
}

export class Redistricter {
  constructor({ blockCount, seedCount, width, height }){
    this.width = width
    this.height = height
    this.totalPopulation = 0
    this.blocks = getRandomCensusBlocks(blockCount, width, height)
    this.seedPositions = getRandomPoints(seedCount, width, height)
    this.blocks.forEach( b => {
      let K = _.sumBy(this.seedPositions, s => distanceSq(b.position, s))
      b.phiByDistrict = _.map(this.seedPositions, p => {
        return calcPhi(b.position, p, K)
      })
      this.totalPopulation += b.population
    })

    this.colors = colorScale.colors(seedCount, 'rgba')
    this.blocksTaken = 0

    this.initDistricts()
  }

  getSeedPositions(){
    return this.seedPositions
  }

  getBlocksInRegion( index ){
    let pos = this.seedPositions[index]
    let blocksInRegion = []
    _.forEach(this.blocks, b => {
      if ( !b.phiByDistrict ){ console.log(b)}
      let i = indexWithLowestValue(b.phiByDistrict)
      if ( i === index ){
        // in region
        let phi = b.phiByDistrict[index]
        let entry = {
          distance: distance(b.position, pos)
          , phi
          , block: b
        }
        let idx = _.sortedIndexBy(blocksInRegion, entry, 'phi')
        blocksInRegion.splice(idx, 0, entry)
      }
    })

    return blocksInRegion
  }

  initDistricts(){
    const len = this.seedPositions.length
    let targetPopulation = Math.floor(this.totalPopulation / len)
    let remainder = this.totalPopulation % len
    this.districts = this.seedPositions.map( (position, i) => {
      let isLast = (i === len - 1)
      return {
        position
        , blocksInRegion: this.getBlocksInRegion( i )
        , population: 0
        // FIXME naiive...
        , targetPopulation: Math.floor(targetPopulation) + (isLast ? remainder : 0)
        , taken: [] // blocks taken
      }
    })

    this.districts.forEach( district => {
      const others = _.without(this.districts, district)
      const othersByDistance = _.sortBy(others, o => distanceSq(o.position, district.position))
      district.blockSorting = district.blocksInRegion.concat([])

      othersByDistance.forEach( o => {
        let copy = _.reverse(o.blocksInRegion.concat([]))
        district.blockSorting = district.blockSorting.concat(copy)
      })
    })
  }

  takeBlock(district){
    if ( district.population >= district.targetPopulation ){ return }
    if ( !district.blockSorting.length ){ return }

    let next = district.blockSorting.shift()

    while ( next.block.isTaken ){
      if ( !district.blockSorting.length ){ return }
      // if it's taken... remove the next
      next = district.blockSorting.shift()
    }

    next.block.isTaken = true
    district.population += next.block.population
    district.taken.push(next.block)
    this.blocksTaken++
  }

  isDone(){
    return this.blocksTaken >= this.blocks.length
  }

  stepBy( nSteps ){
    if ( this.isDone() ){ return }
    for (let i = 0; i < nSteps|0; i++){
      this.step()
    }
  }

  step(){
    if ( this.isDone() ){ return }
    let largestDistrict = _.maxBy(this.districts, 'population')
    let otherDistricts = _.without(this.districts, largestDistrict)

    // largest district takes one block.. if it can
    this.takeBlock(largestDistrict)

    otherDistricts.forEach( district => {
      while (
        !this.isDone() &&
        district.population < largestDistrict.population &&
        district.population < district.targetPopulation
      ){
        this.takeBlock( district )
      }
    })
  }

  getImageData(){
    const width = this.width
    const height = this.height
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')

    let untaken = 0
    this.blocks.forEach(b => {
      if ( b.isTaken ){ return }
      untaken++
      drawCircle(ctx, b.position, 1, 'white')
    })

    console.log(`There are ${untaken} blocks left`, this.districts)

    this.districts.forEach((district, i) => {
      let color = this.colors[i].css()
      district.taken.forEach(b => {
        drawCircle(ctx, b.position, 1, color)
      })
    })

    // draw district seed positions
    this.seedPositions.forEach( (p, i) => {
      drawCircle(ctx, p, 5, this.colors[i].css())
    })

    let data = ctx.getImageData(0, 0, width, height)
    return transfer(data, [data.data.buffer])
  }
}
