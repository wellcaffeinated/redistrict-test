import _ from 'lodash'
import {
  distance
} from '@/lib/math'

export default class Block {
  constructor({ position, population, seeds, calcPhi }){
    this.position = position
    this.population = population
    this.district = null
    this.calcPhi = calcPhi

    this.setSeeds(seeds)
  }

  setSeeds(seeds){
    const calcPhi = this.calcPhi
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
