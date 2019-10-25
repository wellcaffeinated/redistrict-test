import _ from 'lodash'
import {
  distanceSq
} from '@/lib/math'

export default class District {
  constructor({ position, targetPopulation, blocks, index, useSorting }){
    this.position = position
    this.targetPopulation = targetPopulation
    this.index = index
    this.useSorting = useSorting

    this.population = 0
    this.claimed = []
    this.pools = []

    this.setBlocks(blocks)
  }

  clone(){
    let dest = new District(this)
    _.forOwn(this, (val, key) => {
      dest[key] = _.cloneDeep(val)
    })
    return dest
  }

  setBlocks(blocks){
    const index = this.index

    // pools is array of arrays. First contains blocks in own region, ordered by phi (small->large)
    // others contain other regions sorted by distance to this district (small->large)
    this.pools = []
    for (let i = 0, l = blocks.length; i < l; i++){
      let block = blocks[i]
      let rank = block.getPreferenceRankBySeedIndex(index)
      let phi = block.getPhiBySeedIndex(index)
      let distance = block.getDistanceToSeed(index)
      let pool = this.pools[rank] = (this.pools[rank] || [])

      let entry = { rank, phi, distance, block }

      if ( this.useSorting ){
        let idx = _.sortedIndexBy(pool, entry, rank === 0 ? 'phi' : 'distance')
        pool.splice(idx, 0, entry)
      } else {
        pool.push(entry)
      }
    }
  }

  getRegionBlocks(){
    return this.claimed.concat(this.pools[0])
  }

  availablePopulation(){
    return _.sumBy(this.pools[0], 'block.population')
  }

  neededPopulation(){
    return this.targetPopulation - this.population
  }

  selectBlocksWithinRegion(all = false){
    let pool = this.pools[0] || []
    let entry
    while (
      (all || this.population < this.targetPopulation) &&
      (entry = pool.shift())
    ){
      this.claim(entry)
    }
  }

  claim(entry){
    let block = entry.block
    this.population += block.population
    this.claimed.push(entry)
    block.assignTo(this)
  }

  unclaim(entry){
    let block = entry.block
    let idx = _.indexOf(this.claimed, entry)
    if ( idx === -1 ){
      return false
    }

    this.claimed.splice(idx, 1)
    this.population -= block.population
    block.assignTo(null)
    return true
  }

  // give another district a block
  giveBlock(other){
    if ( this.neededPopulation() >= 0 ){ return }
    // TODO: optimize this line
    let mostWanted = _.minBy(this.getRegionBlocks(), entry => distanceSq(entry.block.position, other.position))

    // remove from own pool, or claimed
    if ( !this.unclaim(mostWanted) ){
      _.pull(this.pools[0], mostWanted)
    }

    other.claim(mostWanted)
    // top up self
    this.selectBlocksWithinRegion()
  }
}
