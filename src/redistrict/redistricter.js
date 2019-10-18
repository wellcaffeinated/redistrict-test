import { transfer } from 'comlink'
import _ from 'lodash'
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
} from '@/lib/draw'

import chroma from 'chroma-js'

// preference function
function calcPhi(blockPosition, seedPosition, K){
  let d2 = distanceSq(blockPosition, seedPosition)
  return d2 + Math.sqrt(d2) - K
}

function getPhiRanksForPoint(point, seeds){
  let K = _.sumBy(seeds, s => distanceSq(s, point))
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

class Block {
  constructor({ position, population, seeds }){
    this.position = position
    this.population = population

    this.claimedBy = []

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

  recordClaim(index){
    this.claimedBy.push(index)
  }

  isClaimed(){
    return this.claimedBy.length > 0
  }

  isContested(){
    return this.claimedBy.length > 1
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

    this.uncontestedPopulation = 0
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

      let idx = _.sortedIndexBy(pool, entry, rank === 0 ? phi : distance)
      pool.splice(idx, 0, entry)
    })
  }

  refreshPopulationCounts(){
    this.population = 0
    this.uncontestedPopulation = 0
    for (let i = 0, l = this.claimed.length; i < l; i++){
      let entry = this.claimed[i]

      this.population += entry.block.population

      if ( !entry.block.isContested() ){
        this.uncontestedPopulation = 0
      }
    }
  }

  runPhase(phase = 0){
    this.refreshPopulationCounts()
    for (let rank = 0; rank <= phase; rank++){
      this.pickUncontested(rank)
      if ( this.uncontestedPopulation >= this.targetPopulation ){
        break
      }
    }
  }

  claim(entry){
    let block = entry.block
    this.population += block.population
    if ( !block.isClaimed() ){
      this.uncontestedPopulation += block.population
    }

    this.claimed.push(entry)
    block.recordClaim(this.index)
  }

  pickUncontested(rank){
    let pool = this.pools[rank]
    for (let i = 0, l = pool.length; i < l; i++){
      if ( this.uncontestedPopulation >= this.targetPopulation ){
        break
      }

      let entry = pool[i]
      if ( !entry.block.isClaimed() ){
        this.claim(entry)
      }
    }
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

    this.restart()
  }

  restart(){
    this.seeds = getRandomPoints(this.seedCount, this.width, this.height)
    this.blocks = this.blockData.map(data => new Block({ ...data, seeds: this.seeds }))
    this.totalPopulation = _.sum(this.blocks, b => b.population)

    this.initDistricts()
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

  getSeedPositions(){
    return this.seeds
  }

  getRankMapFor(index){
    const regionColors = chroma.scale('Paired').colors(this.seeds.length, 'rgba')
    const colorScale = chroma.scale(['rgba(0,0,0,0)', 'black'])
    const width = this.width
    const height = this.height
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')

    const colors = colorScale.colors(this.seeds.length, 'rgba')

    for (let y = 0; y < height; y++){
      for (let x = 0; x < width; x++){
        let p = {x, y}
        let rank = rankOfPoint(p, index, this.seeds)
        let color = colors[rank]
        setPixel(ctx, x, y, color.css())
      }
    }

    this.seeds.forEach( (s, i) =>
      drawCircle(ctx, s, 5, regionColors[i].css())
    )

    let data = ctx.getImageData(0, 0, width, height)
    return transfer(data, [data.data.buffer])
  }

  getRegionMap(){
    const colorScale = chroma.scale('Paired')
    const width = this.width
    const height = this.height
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')

    const colors = colorScale.colors(this.seeds.length, 'rgba')

    let points = []
    let phiStats = _.times(this.seeds.length, () => RunningStatistics())

    for (let y = 0; y < height; y++){
      for (let x = 0; x < width; x++){
        let p = {x, y}
        let phis = getPhiRanksForPoint(p, this.seeds)
        let { index, phi } = phis[0]
        points.push({ point: p, phi, index })
        phiStats[index].push(phi)
      }
    }

    for (let i = 0, l = points.length; i < l; i++){
      let { index, phi, point } = points[i]
      let stats = phiStats[index]
      let range = stats.min() - stats.max()
      let alpha = (phi - stats.max())/range
      let color = colors[index]
      setPixel(ctx, point.x, point.y, color.luminance(alpha).css())
    }

    this.districts.forEach( (d, i) =>
      drawCircle(ctx, d.position, 5, colors[i])
    )

    let data = ctx.getImageData(0, 0, width, height)
    return transfer(data, [data.data.buffer])
  }

  // getImageData(){
  //   const width = this.width
  //   const height = this.height
  //   const canvas = new OffscreenCanvas(width, height)
  //   const ctx = canvas.getContext('2d')
  //
  //   let untaken = 0
  //   this.blocks.forEach(b => {
  //     if ( b.isTaken ){ return }
  //     untaken++
  //     drawCircle(ctx, b.position, 1, 'white')
  //   })
  //
  //   // console.log(`There are ${untaken} blocks left`, this.districts)
  //
  //   this.districts.forEach((district, i) => {
  //     let color = this.colors[i].css()
  //     district.taken.forEach(b => {
  //       drawCircle(ctx, b.position, 1, color)
  //     })
  //   })
  //
  //   // draw district seed positions
  //   this.seedPositions.forEach( (p, i) => {
  //     drawCircle(ctx, p, 5, this.colors[i].css())
  //   })
  //
  //   let data = ctx.getImageData(0, 0, width, height)
  //   return transfer(data, [data.data.buffer])
  // }
}
