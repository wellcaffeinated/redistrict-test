<template lang="pug">
.home
  b-loading(:active="loading")
  .columns
    .column
      .canvas
        .selected-block(v-if="selectedBlock", :style="{ top: selectedBlock.position.y + 'px', left: selectedBlock.position.x + 'px' }")
        canvas(ref="canvas", width="500", height="500")
        canvas(ref="canvasTop", width="500", height="500", @mousemove="onMouseMove", @mouseleave="seedIndex = -1")
    .column
      pre
        | seed movement: {{ seedMovement }}
        | population percent diff: {{ populationPercentDiff }}%
        | number of unchosen blocks: {{ numUnchosenBlocks }}
      pre
        | district: {{ seedIndex }}
        | target population: {{ districtInfo.targetPopulation }}
        | population: {{ districtInfo.population }}
        | needs: {{ districtInfo.targetPopulation - districtInfo.population }}
      pre(v-if="selectedBlock")
        | block ({{ selectedBlock.position.x }}, {{ selectedBlock.position.y }})
        | population: {{ selectedBlock.population }}
  .controls
    b-field(grouped)
      b-field(label="Number of Blocks")
        b-input(v-model="numBlocks", type="number")
      b-field(label="Number of Districts")
        b-input(v-model="numDistricts", type="number")
      b-field
        b-button.is-primary(@click="init") Restart
    b-field(grouped)
      b-field
        b-select(v-model="overlayMode")
          option(value="ranks") Rank maps
          option(value="phi") Phi maps
      b-field
        b-button(@click="getOverlays") Draw Overlays
      b-field
        b-button(@click="drawPhiRegions") Draw Phi Gradients
    b-field(grouped)
      b-switch(v-model="useSorting") Use Sorting
      b-switch(v-model="showAssignmentRegions") Show Assignment Regions
    b-field(grouped)
      b-field
        b-button(@click="selectBlocks") Select Blocks
      b-field
        b-button(@click="adjustSeeds") Adjust Seeds
      b-field
        b-button(@click="runUntilStable") Stablize Seeds
      b-field
        b-button(@click="redistribute") Redistribute
      b-field
        b-button.is-primary(@click="randomizeSeeds") Reshuffle Seeds
    b-field(grouped)
      b-field
        b-button.is-primary.is-large(@click="run") Redistrict!
</template>

<script>
import _min from 'lodash/min'
import _minBy from 'lodash/minBy'
import _throttle from 'lodash/throttle'
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
    , loading: false
    , numBlocks: 2000
    , numDistricts: 5
    , useSorting: true
    , showAssignmentRegions: false
    , seedIndex: -1
    , selectedBlock: null
    , overlayMode: 'ranks'
    , overlays: null
    , seedMovement: null
    , populationPercentDiff: null
    , districtInfo: {}
    , numUnchosenBlocks: -1
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
    , async useSorting(){
      await this.redistricter.enableSorting(this.useSorting)
      await this.redistricter.restart()
    }
    , showAssignmentRegions(){
      this.drawRegions()
    }
    , working: _throttle(function(working){
      this.loading = working > 0
    }, 200, { leading: false })
  }
  , methods: {
    async init(){
      this.working++
      const canvas = this.$refs.canvas
      this.redistricter = await new worker.Redistricter({
        blocks: this.numBlocks | 0
        , seedCount: this.numDistricts | 0
        , width: canvas.width
        , height: canvas.height
        , useSorting: this.useSorting
      })
      this.seedCoords = await this.redistricter.getSeedPositions()
      this.blocks = await this.redistricter.getBlocks()
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
    , onMouseMove(e){
      if ( !this.seedCoords ){ return }
      let x = e.layerX
      let y = e.layerY

      this.selectedBlock = _minBy(this.blocks, b => distanceSq({x, y}, b.position))
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
    , async randomizeSeeds(){
      this.working++
      await this.redistricter.randomizeSeeds()
      await this.drawRegions()
      this.working--
    }
    , async getInfo(){
      this.populationPercentDiff = await this.redistricter.getMaxPopulationDifferencePercentage()
      this.numUnchosenBlocks = await this.redistricter.getNumUnchosenBlocks()
    }
    , async selectBlocks(nodraw){
      this.overlays = null
      await this.redistricter.selectBlocks()
      await this.getInfo()
      if ( nodraw !== true ){
        await this.drawRegions()
      }
    }
    , async runUntilStable(){
      const threshold = 1e-6
      do {
        await this.selectBlocks()
        await this.adjustSeeds(true)
      } while ( this.seedMovement > threshold );
      await this.selectBlocks()
    }
    , async adjustSeeds(nodraw){
      this.seedMovement = await this.redistricter.adjustSeedPositions()
      this.seedCoords = await this.redistricter.getSeedPositions()
      this.blocks = await this.redistricter.getBlocks()
      if ( nodraw !== true ){
        await this.drawRegions()
      }
    }
    , async redistribute(){
      let popDiff = this.populationPercentDiff
      let lastDiffs = []
      let maxRounds = 100
      while (maxRounds--){
        await this.redistricter.redistribute()
        await this.getInfo()
        popDiff = this.populationPercentDiff
        await this.drawRegions()
        if ( popDiff < 2 ){
          if ( lastDiffs.length > 10 ){
            lastDiffs.shift()

            // test for threshold
            let minDiffSoFar = _min(lastDiffs)
            if ( popDiff <= minDiffSoFar ){
              break
            }
          }

          lastDiffs.push(popDiff)
        }
      }
    }
    , async drawRegions(){
      if ( this.showAssignmentRegions ){
        this.regionsImage = await this.redistricter.getAssignmentMap()
      } else {
        this.regionsImage = await this.redistricter.getRegionMap()
      }

      this.drawImage(this.$refs.canvas, this.regionsImage)
    }
    , async drawPhiRegions(){
      this.working++
      let voronoiImage = await this.redistricter.getPhiRegionMap()
      this.drawImage(this.$refs.canvas, voronoiImage)
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
    , async run(){
      await this.runUntilStable()
      await this.redistribute()
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
  .selected-block
    position: absolute
    z-index: 2
    width: 4px
    height: 4px
    margin-left: -1px
    margin-top: -1px
    border-radius: 50%
    background: red
canvas
  border: 1px solid rgba(255, 255, 255, 0.3)
</style>
