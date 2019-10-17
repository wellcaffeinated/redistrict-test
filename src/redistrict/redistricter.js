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
} from '@/lib/math'

// preference function
function calcPhi(blockPosition, seedPosition, K){
  let d2 = distanceSq(blockPosition, seedPosition)
  return d2 + Math.sqrt(d2) - K
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
    this.distanceBySeedIndex = _.map(seeds, s => distance(b.position, s))
    let K = _.sumBy(this.distanceBySeedIndex, d => d * d)
    this.phiBySeedIndex = _.map(this.seeds, seed => {
      return calcPhi(this.position, seed, K)
    })
    this.seedPreferenceOrder = _(this.phiBySeedIndex)
      .map((phi, index) => ({ phi, index })))
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
    thsi.claimed = []

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
    let remainder = this.totalPopulation % len
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
    return this.seedPositions
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
