import { transfer } from 'comlink'
import _ from 'lodash'
import Voronoi from '@/lib/rhill-voronoi-core'
import {
  scale
  , indexWithLowestValue
} from '@/lib/util'
import {
  lerp
  , distance
  , distanceSq
  , getCentroid
  , getRandomPoints
  , RunningStatistics
} from '@/lib/math'
import {
  setPixel
  , drawCircle
  , drawPolygon
} from '@/lib/draw'

const voronoi = new Voronoi()

import chroma from 'chroma-js'

function calcK(point, seeds){
  return _.sumBy(seeds, s => distanceSq(s, point))
}

// preference function
function calcPhi(blockPosition, seedPosition, K, w = 1){
  let d2 = distanceSq(blockPosition, seedPosition)
  return d2 + Math.sqrt(d2) - w * K
}

function getPhiRanksForPoint(point, seeds){
  let K = calcK(point, seeds)
  let phiRanks = seeds.map((s, index) => ({ phi: calcPhi(point, s, K), index }))
  return _.sortBy(phiRanks, 'phi')
}



function getRegionIndex(point, seeds){
  let phiRanks = getPhiRanksForPoint(point, seeds)
  return phiRanks[0].index
}

function rankOfPoint(point, index, seeds){
  let phiRanks = getPhiRanksForPoint(point, seeds)
  return _.findIndex(phiRanks, { index })
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

function drawDistrictBlocks(ctx, district, color, populationColorScale){
  _.forEach(district.pools[0], entry => {
    let pos = entry.block.position
    let color = populationColorScale ? populationColorScale(entry.block.population) : 'white'
    drawCircle(ctx, pos, 1, color)
  })
  _.forEach(district.claimed, entry => {
    let pos = entry.block.position
    drawCircle(ctx, pos, 1, color)
  })
}

class Block {
  constructor({ position, population, seeds }){
    this.position = position
    this.population = population
    this.district = null

    this.setSeeds(seeds)
  }

  setSeeds(seeds){
    this.seeds = seeds
    this.distanceBySeedIndex = _.map(seeds, s => distance(this.position, s))
    let K = _.sumBy(this.distanceBySeedIndex, d => d * d)
    this.phiBySeedIndex = _.map(this.seeds, seed => {
      return calcPhi(this.position, seed, K)
    })
    this.seedPreferenceOrder = _(this.phiBySeedIndex)
      .map((phi, index) => ({ phi, index }))
      .sortBy('phi')
      .map(el => el.index)
      .value()
  }

  assignTo(district){
    this.district = district
  }

  isClaimed(){
    return !!this.district
  }

  getDistanceToSeed(index){
    return this.distanceBySeedIndex[index]
  }

  getPhiBySeedIndex(index){
    return this.phiBySeedIndex[index]
  }

  getPreferenceRankBySeedIndex(index){
    return this.seedPreferenceOrder.indexOf(index)
  }

  getSeedIndexByPreferenceRank(rank){
    return this.seedPreferenceOrder[rank]
  }
}

class District {
  constructor({ position, targetPopulation, blocks, index }){
    this.position = position
    this.targetPopulation = targetPopulation
    this.index = index

    this.population = 0
    this.claimed = []

    this.setBlocks(blocks)
  }

  setBlocks(blocks){
    const index = this.index

    // pools is array of arrays. First contains blocks in own region, ordered by phi (small->large)
    // others contain other regions sorted by distance to this district (small->large)
    this.pools = []
    _.forEach(blocks, block => {
      let rank = block.getPreferenceRankBySeedIndex(index)
      let phi = block.getPhiBySeedIndex(index)
      let distance = block.getDistanceToSeed(index)
      let pool = this.pools[rank] = (this.pools[rank] || [])

      let entry = { rank, phi, distance, block }

      let idx = _.sortedIndexBy(pool, entry, rank === 0 ? 'phi' : 'distance')
      pool.splice(idx, 0, entry)
    })
  }

  availablePopulation(){
    return _.sumBy(this.pools[0], 'block.population')
  }

  selectBlocksWithinRegion(){
    let pool = this.pools[0]
    let entry
    while ( entry = pool.shift() ){
      if ( this.population >= this.targetPopulation ){
        break
      }

      this.claim(entry)
    }
  }

  claim(entry){
    let block = entry.block
    this.population += block.population
    this.claimed.push(entry)
    block.assignTo(this)
  }
}

export class Redistricter {
  constructor({ blocks, seedCount, width, height }){
    this.width = width
    this.height = height
    this.seedCount = seedCount

    // testing...
    if ( Number.isFinite(blocks) ){
      blocks = getRandomCensusBlocks(blocks, width, height)
    }

    this.blockData = blocks

    this.randomizeSeeds()
  }

  randomizeSeeds(){
    this.seeds = getRandomPoints(this.seedCount, this.width, this.height)
    this.restart()
  }

  restart(){
    this.blocks = this.blockData.map(data => new Block({ ...data, seeds: this.seeds }))
    this.totalPopulation = _.sumBy(this.blocks, b => b.population)

    this.initDistricts()
  }

  adjustSeedPositions(){
    let newSeeds = _.map(this.districts, (district, i) => {
      let points = []
      let weights = []
      district.claimed.forEach(entry => {
        points.push(entry.block.position)
        weights.push(entry.block.population)
        entry.block.district = null
      })
      return getCentroid(points, weights)
    })

    let seedMovement = _.max(_.map(newSeeds, (s, i) => {
      return distance(s, this.seeds[i])
    }))

    this.seeds = newSeeds
    this.restart()
    return seedMovement
  }

  initDistricts(){
    let targetPopulation = Math.floor(this.totalPopulation / this.seedCount)
    let remainder = this.totalPopulation % this.seedCount
    this.districts = this.seeds.map((position, index) => {
      let fudge = Math.max(0, remainder--) && 1
      return new District({
        position
        , index
        , targetPopulation: targetPopulation + fudge
        , blocks: this.blocks
      })
    })
  }

  run(){
    _.forEach(this.districts, district => {
      district.selectBlocksWithinRegion()
    })
  }

  getSeedPositions(){
    return this.seeds
  }

  getMaxPopulationDifferencePercentage(){
    let min = _.minBy(this.districts, 'population').population
    let max = _.maxBy(this.districts, 'population').population

    return 100 * (max - min) / (0.5 * (max + min))
  }

  getDistrict(index){
    return this.districts[index]
  }

  getPhiMapFor(index){
    const regionColors = chroma.scale('Paired').colors(this.seedCount, 'rgba')
    const width = this.width
    const height = this.height
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')

    let points = []
    let phiStats = RunningStatistics()

    for (let y = 0; y < height; y++){
      for (let x = 0; x < width; x++){
        let p = {x, y}
        let phis = getPhiRanksForPoint(p, this.seeds)
        let rank = _.findIndex(phis, { index })
        let phi = phis[rank].phi
        points.push({ point: p, phi, index: phis[0].index, rank })
        phiStats.push(phi)
      }
    }

    let scale = chroma.scale(['rgba(0, 0, 0, 0.8)', 'rgba(255,255,255,0.8)'])

    for (let i = 0, l = points.length; i < l; i++){
      let { rank, phi, point, index } = points[i]
      let stats = phiStats
      let range = stats.min() - stats.max()
      let alpha = (phi - stats.max())/range
      let color = scale(alpha)
      setPixel(ctx, point.x, point.y, color.css())
    }

    this.seeds.forEach( (s, i) =>
      drawCircle(ctx, s, 5, regionColors[i].css())
    )

    let data = ctx.getImageData(0, 0, width, height)
    return transfer(data, [data.data.buffer])
  }

  getRankMapFor(index){
    const regionColors = chroma.scale('Paired').colors(this.seedCount, 'rgba')
    const width = this.width
    const height = this.height
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')

    let points = []
    let phiStats = RunningStatistics()

    for (let y = 0; y < height; y++){
      for (let x = 0; x < width; x++){
        let p = {x, y}
        let phis = getPhiRanksForPoint(p, this.seeds)
        let rank = _.findIndex(phis, { index })
        let phi = phis[rank].phi
        points.push({ point: p, phi, index: phis[0].index, rank })
        phiStats.push(phi)
      }
    }

    let scales = regionColors.map(c => this.seeds.map((s, r) => {
      let col = c.darken(r)
      return chroma.scale([col, col.luminance(1)])
    }))

    for (let i = 0, l = points.length; i < l; i++){
      let { rank, phi, point, index } = points[i]
      let stats = phiStats
      let range = stats.min() - stats.max()
      let alpha = (phi - stats.max())/range
      // let color = regionColors[index].luminance(alpha).darken(rank)
      let scale = scales[index][rank]
      let color = scale(alpha)
      setPixel(ctx, point.x, point.y, color.css())
    }

    // const colors = colorScale.colors(this.seedCount, 'rgba')
    //
    // for (let y = 0; y < height; y++){
    //   for (let x = 0; x < width; x++){
    //     let p = {x, y}
    //     let rank = rankOfPoint(p, index, this.seeds)
    //     let color = colors[rank]
    //     setPixel(ctx, x, y, color.css())
    //   }
    // }

    this.seeds.forEach( (s, i) =>
      drawCircle(ctx, s, 5, regionColors[i].css())
    )

    let data = ctx.getImageData(0, 0, width, height)
    return transfer(data, [data.data.buffer])
  }

  getPhiRegionMap(){
    const colorScale = chroma.scale('Paired')
    const width = this.width
    const height = this.height
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')

    const colors = colorScale.colors(this.seedCount, 'rgba')

    let points = []
    let phiStats = _.times(this.seedCount, () => RunningStatistics())

    for (let y = 0; y < height; y++){
      for (let x = 0; x < width; x++){
        let p = {x, y}
        let phis = getPhiRanksForPoint(p, this.seeds)
        let { index, phi } = phis[0]
        points.push({ point: p, phi, index })
        phiStats[index].push(phi)
      }
    }

    let scales = colors.map(c => chroma.scale([c, c.luminance(1)]))
    for (let i = 0, l = points.length; i < l; i++){
      let { index, phi, point } = points[i]
      let stats = phiStats[index]
      let range = stats.min() - stats.max()
      let alpha = (phi - stats.max())/range
      let color = scales[index](alpha) // colors[index].luminance(alpha)
      setPixel(ctx, point.x, point.y, color.css())
    }

    let maxPopulation = _.max(this.blocks.map(b => b.population))
    let populationColorScale = chroma.scale(['black', 'white']).mode('lab').domain([0, maxPopulation])

    this.districts.forEach( (d, i) => {
      drawDistrictBlocks(ctx, d, colors[i], populationColorScale)
      drawCircle(ctx, d.position, 7, d.population >= d.targetPopulation ? 'white' : 'black')
      drawCircle(ctx, d.position, 5, colors[i])
    })

    let data = ctx.getImageData(0, 0, width, height)
    return transfer(data, [data.data.buffer])
  }

  getRegionMap(){
    const colorScale = chroma.scale('Paired')
    const width = this.width
    const height = this.height
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')

    const colors = colorScale.colors(this.seedCount, 'rgba')

    const bbox = { xl: 0, yt: 0, xr: width, yb: height }

    const sites = this.seeds.map(_.clone)
    let diagram = voronoi.compute(sites, bbox)

    for (let i = 0, l = this.seedCount; i < l; i++) {
      let cell = diagram.cells[sites[i].voronoiId]
      if (cell) {
        let halfedges = cell.halfedges
        let length = halfedges.length
        if (length > 2) {
          let points = []
          for (let j = 0; j < length; j++) {
            let v = halfedges[j].getEndpoint()
            points.push(v)
          }

          drawPolygon(ctx, points, colors[i].luminance(0.6).css())
        }
      }
    }

    let maxPopulation = _.max(this.blocks.map(b => b.population))
    let populationColorScale = chroma.scale(['black', 'white']).mode('lab').domain([0, maxPopulation])

    this.districts.forEach( (d, i) => {
      let color = colors[i].luminance(0.2)
      drawDistrictBlocks(ctx, d, color, populationColorScale)
      drawCircle(ctx, d.position, 7, d.population >= d.targetPopulation ? 'white' : 'black')
      drawCircle(ctx, d.position, 5, color)
    })

    let data = ctx.getImageData(0, 0, width, height)
    return transfer(data, [data.data.buffer])
  }
}
