import { transfer } from 'comlink'
import _ from 'lodash'
import {
  lerp
  , distance
  , distanceSq
  , getCentroid
  , getRandomPoints
} from '@/lib/math'

import {
  scale
  , indexWithLowestValue
} from '@/lib/util'

import {
  setPixel
  , drawCircle
} from '@/lib/draw'

import chroma from 'chroma-js'
const colorScale = chroma.scale('Paired')

function getNearestSeed(p, seeds = []){
  return _.minBy(seeds, s => distance(p, s))
}

function calcPhi(p, seed, K, weight ){
  let d2 = distanceSq(p, seed)
  return d2 + Math.sqrt(d2) - K * (1 + weight)
  // return d2 - K * (1 + weight)
  // return d2 + Math.sqrt(d2) * (1 + weight)
}

function drawRegion( ctx, region, color ){
  const l = region.length
  let min = _.minBy(region, 'phi').phi
  let max = _.maxBy(region, 'phi').phi
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
      let nearest = _.minBy(seeds, s => calcPhi(p, s, K, s.weight))
      let index = _.indexOf(seeds, nearest)
      let phi = calcPhi(p, nearest, K, nearest.weight)
      let region = regions[index]
      let entry = { p, phi }
      // let eidx  = _.sortedIndexBy(region, entry, 'phi')
      // region.splice(eidx, 0, entry)
      region.push(entry)
    }
  }

  regions.forEach( (r, i) => drawRegion(ctx, r, colors[i]) )

  seeds.forEach( s => {
    drawCircle(ctx, s, 5, 'white')
  })
}

export function getImageData(width, height, seeds = [], weights = []){
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')

  seeds.forEach((s,i) => {
    s.weight = weights[i]
  })
  draw(ctx, seeds)

  let data = ctx.getImageData(0, 0, width, height)
  return transfer(data, [data.data.buffer])
}

///

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
    this.blocks = getRandomCensusBlocks(blockCount, width, height)
    this.seedPositions = getRandomPoints(seedCount, width, height)
    this.districtWeights = _.times(seedCount, () => 0)
    this.colors = colorScale.colors(seedCount, 'rgba')

    this.restart()
  }

  restart(){
    this.totalPopulation = 0
    this.blocks.forEach( b => {
      b.distanceByDistrict = _.map(this.seedPositions, s => distance(b.position, s))
      let K = _.sumBy(b.distanceByDistrict, d => d*d)
      b.phiByDistrict = _.map(this.seedPositions, (p, i) => {
        let weight = this.districtWeights[i]
        return calcPhi(b.position, p, K, weight)
      })
      b.isTaken = false
      this.totalPopulation += b.population
    })
    this.blocksTaken = 0
    this.initDistricts()
  }

  adjustSeedPositions(){
    this.seedPositions = this.districts.map( (district, i) => {
      let coords = []
      let weights = []
      district.taken.forEach((b, i) => {
        let phi = b.phiByDistrict[i]
        coords.push(b.position)
        weights.push(b.population)
      })
      let centroid = getCentroid(coords)
      // let a = district.targetPopulation
      // let b = _.sumBy(district.blocksInRegion, 'block.population')
      // let x = lerp(district.position.x, centroid.x, (a-b)/a)
      // let y = lerp(district.position.y, centroid.y, (a-b)/a)
      let x = centroid.x
      let y = centroid.y
      return { x, y }
    })
  }

  adjustWeights(){
    let diffs = this.districts.map( (district, i) => {
      let a = district.targetPopulation
      let b = _.sumBy(district.blocksInRegion, 'block.population')
      return {
        pd: (a-b)/(0.5 * (a+b))
        , index: i
      }
    })

    // let largest = _.maxBy(diffs, 'pd')
    // this.districtWeights[largest.index] = 0.01 * largest.pd

    this.districtWeights = diffs.map( d => 0.01 * d.pd )
    let norm = _.sum( this.districtWeights )
    this.districtWeights = this.districtWeights.map( d => d - norm / diffs.length )
    console.log(this.districtWeights)
  }

  getSeedPositions(){
    return this.seedPositions
  }

  getSeedWeights(){
    return this.districtWeights
  }

  getBlocksInRegion( index ){
    let pos = this.seedPositions[index]
    let blocksInRegion = []
    _.forEach(this.blocks, b => {
      let i = indexWithLowestValue(b.phiByDistrict)
      if ( i === index ){
        // in region
        let phi = b.phiByDistrict[index]
        let distance = b.distanceByDistrict[index]
        let entry = {
          distance
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
      let blocksInRegion = this.getBlocksInRegion( i )
      let regionPopulation = _.sumBy(blocksInRegion, 'block.population')
      return {
        position
        , blocksInRegion
        , regionPopulation
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
    let otherDistricts = _.sortBy(_.without(this.districts, largestDistrict), 'population')

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

  getMaxPopulationDifferencePercentage(){
    let min = _.minBy(this.districts, 'regionPopulation').regionPopulation
    let max = _.maxBy(this.districts, 'regionPopulation').regionPopulation

    return 100 * (max - min) / (0.5 * (max + min))
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

    // console.log(`There are ${untaken} blocks left`, this.districts)

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
