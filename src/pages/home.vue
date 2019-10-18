<template lang="pug">
.home
  b-loading(:active="working > 0")
  .columns
    .column
      .canvas
        canvas(ref="canvas", width="500", height="500")
        canvas(ref="canvasTop", width="500", height="500", @mousemove="selectNearestIndex", @mouseleave="seedIndex = -1")
    .column
      pre
        | seed movement: {{ seedMovement }}
        | population percent diff: {{ populationPercentDiff }}%
      pre
        | district: {{ seedIndex }}
        | target population: {{ districtInfo.targetPopulation }}
        | population: {{ districtInfo.population }}
  .controls
    b-field(grouped)
      b-field
        b-select(v-model="overlayMode")
          option(value="ranks") Rank maps
          option(value="phi") Phi maps
      b-field
        b-button(@click="getOverlays") Draw Overlays
    b-field(grouped)
      b-field
        b-button(@click="run") Run
      b-field
        b-button(@click="adjustSeeds") Adjust Seeds
      b-field
        b-button(@click="runUntilStable") Stablize Seeds
</template>

<script>
import _minBy from 'lodash/minBy'
import createWorker from '@/workers/main'
import {
  distanceSq
} from '@/lib/math'

const worker = createWorker()

export default {
  name: 'Home'
  , props: {
  }
  , components: {
  }
  , data: () => ({
    working: 0
    , seedIndex: -1
    , overlayMode: 'ranks'
    , overlays: null
    , seedMovement: null
    , populationPercentDiff: null
    , districtInfo: {}
  })
  , mounted(){
    this.init()
  }
  , watch: {
    seedIndex(index){
      if ( Number.isFinite(index|0) ){
        this.drawOverlays()
        this.getDistrictInfo()
      }
    }
    , overlayMode(){
      this.getOverlays()
    }
  }
  , methods: {
    async init(){
      this.working++
      const canvas = this.$refs.canvas
      this.redistricter = await new worker.Redistricter({
        blocks: 2000
        , seedCount: 6
        , width: canvas.width
        , height: canvas.height
      })
      this.seedCoords = await this.redistricter.getSeedPositions()
      await this.drawRegions()
      // await this.getOverlays()
      // await this.drawOverlays()
      this.working--
    }
    , async getOverlays(){
      this.working++
      let fn = this.overlayMode === 'ranks' ? 'getRankMapFor' : 'getPhiMapFor'
      let overlays = []
      for (let i = 0; i < this.seedCoords.length; i++){
        let data = await this.redistricter[fn](i)
        overlays.push(data)
      }
      this.overlays = overlays
      this.working--
    }
    , selectNearestIndex(e){
      if ( !this.seedCoords ){ return }
      let x = e.layerX
      let y = e.layerY
      let seed = _minBy(this.seedCoords, s => distanceSq({x, y}, s))
      this.seedIndex = this.seedCoords.indexOf(seed)
    }
    , drawImage(canvas, data){
      const ctx = canvas.getContext('2d')
      ctx.putImageData(data, 0, 0)
    }
    , clearCanvas(canvas){
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    , async getDistrictInfo(){
      if ( this.seedIndex < 0 ){
        this.districtInfo = {}
        return
      }
      let district = await this.redistricter.getDistrict(this.seedIndex)
      this.districtInfo = district
    }
    , async run(nodraw){
      this.working++
      this.overlays = null
      await this.redistricter.run()
      this.populationPercentDiff = await this.redistricter.getMaxPopulationDifferencePercentage()
      if ( nodraw !== true ){
        await this.drawRegions()
      }
      this.working--
    }
    , async runUntilStable(){
      this.working++
      const threshold = 1e-6
      do {
        await this.run(true)
        await this.adjustSeeds(true)
      } while ( this.seedMovement > threshold );
      await this.run(true)
      await this.drawRegions()
      this.working--
    }
    , async adjustSeeds(nodraw){
      this.working++
      this.seedMovement = await this.redistricter.adjustSeedPositions()
      this.seedCoords = await this.redistricter.getSeedPositions()
      if ( nodraw !== true ){
        await this.drawRegions()
      }
      this.working--
    }
    , async drawRegions(){
      this.working++
      this.regionsImage = await this.redistricter.getRegionMap()
      this.drawImage(this.$refs.canvas, this.regionsImage)
      this.working--
    }
    , async drawOverlays(){
      if ( this.seedIndex < 0 || !this.overlays ) {
        this.clearCanvas(this.$refs.canvasTop)
        return
      }
      this.working++
      this.drawImage(this.$refs.canvasTop, this.overlays[this.seedIndex])
      this.working--
    }
  }
}
</script>

<style lang="sass" scoped>
.home
  padding: 1rem
.canvas
  position: relative
  canvas + canvas
    position: absolute
    top: 0
    left: 0
canvas
  border: 1px solid rgba(255, 255, 255, 0.3)
</style>
