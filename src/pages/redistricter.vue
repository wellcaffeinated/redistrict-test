<template lang="pug">
.wrap
  .canvas
    canvas(ref="regionCanvas", width="500", height="500")
    canvas(ref="canvas", width="500", height="500")
  .controls
    p District Max Population Difference: {{ populationPercentDiff }}%
    br/
    b-field(grouped, v-if="!isDone")
      b-field
        b-button(@click="run", :loading="working") Run One Iteration
      b-field
        b-button(@click="step", :loading="working") Step
    b-field(grouped, v-if="isDone")
      b-field
        b-button(@click="adjustAndRestart", :loading="working") Adjust Seed Positions
      b-field
        b-button(@click="adjustWeightsAndRestart", :loading="working") Adjust Seed Weights
</template>

<script>
import _times from 'lodash/times'
import createWorker from '@/workers/main'

const worker = createWorker()
const drawWorker = new createWorker()

export default {
  name: 'Redistricter'
  , props: {
  }
  , components: {
  }
  , data: () => ({
    working: false
    , seeds: null
    , redistricter: null
    , isDone: false
    , iteration: 0
    , populationPercentDiff: 0
  })
  , mounted(){
    this.initRedistricter().then(() => {
      return this.drawRegions()
    }).catch(e => {
      console.error(e)
    }).finally(() => {
      this.working = false
    })
  }
  , watch: {
    seeds(){
      this.drawRegions()
    }
  }
  , methods: {
    async initRedistricter(){
      this.working = true
      const canvas = this.$refs.canvas
      const width = canvas.width
      const height = canvas.height

      this.redistricter = await new worker.Redistricter({
        seedCount: 10
        , blockCount: 1000
        , width
        , height
      })

      await this.fetchSeeds()

      await this.draw()
      this.populationPercentDiff = await this.redistricter.getMaxPopulationDifferencePercentage()
      this.working = false
    }
    , async drawRegions(){
      console.log('drawRegions')
      this.working = true
      const canvas = this.$refs.regionCanvas
      const ctx = canvas.getContext('2d')
      const width = canvas.width
      const height = canvas.height
      let regionData = await drawWorker.getImageData(canvas.width, canvas.height, this.seeds.positions, this.seeds.weights)
      ctx.putImageData(regionData, 0, 0)
      this.working = false
    }
    , async draw(){
      this.working = true
      const canvas = this.$refs.canvas
      const ctx = canvas.getContext('2d')

      let data = await this.redistricter.getImageData()
      ctx.putImageData(data, 0, 0)
      this.working = false
    }
    , async run(){
      this.working = true
      while ( !await this.redistricter.isDone() ){
        this.step()
      }
      this.working = false
    }
    , async step(){
      await this.redistricter.step()
      await this.draw()
      this.isDone = await this.redistricter.isDone()
    }
    , async adjustAndRestart(){
      this.working = true
      this.iteration++
      // if ( this.iteration % 2 ){
        await this.redistricter.adjustSeedPositions()
      // } else {
        // await this.redistricter.adjustWeights()
      // }
      await this.redistricter.restart()
      await this.fetchSeeds()
      await this.draw()
      this.populationPercentDiff = await this.redistricter.getMaxPopulationDifferencePercentage()
      this.isDone = false
      this.working = false
    }
    , async adjustWeightsAndRestart(){
      this.working = true
      this.iteration++
      // if ( this.iteration % 2 ){
        // await this.redistricter.adjustSeedPositions()
      // } else {
        await this.redistricter.adjustWeights()
      // }
      await this.redistricter.restart()
      await this.fetchSeeds()
      await this.draw()
      this.populationPercentDiff = await this.redistricter.getMaxPopulationDifferencePercentage()
      this.isDone = false
      this.working = false
    }
    , async fetchSeeds(){
      this.seeds = {
        positions: await this.redistricter.getSeedPositions()
        , weights: await this.redistricter.getSeedWeights()
      }
    }
  }
}
</script>

<style lang="sass" scoped>
.wrap
  padding: 1rem
canvas
  border: 1px solid rgba(255, 255, 255, 0.3)
.canvas
  position: relative
  canvas
    position: absolute
    top: 0
    left: 0
    z-index: 0
  canvas:last-child
    position: relative
    z-index: 1
</style>
