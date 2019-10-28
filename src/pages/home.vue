<template lang="pug">
.home
  .columns
    .column
      .canvas
        //- b-loading(:active="loading", :is-full-page="false")
        .selected-block(v-if="selectedBlock", :style="{ top: selectedBlock.position.y + 'px', left: selectedBlock.position.x + 'px' }")
        canvas(ref="canvas", width="500", height="500")
        canvas(ref="canvasTop", width="500", height="500", @mousemove="onMouseMove", @mouseleave="seedIndex = -1")
    .column
      pre
        | == Block Population Statistics ==
        |
        template(v-for="(val, key) in blockStatistics")
          | {{ key }}: {{ val }}
          |
      pre
        | == Districts ==
        | seed movement: {{ seedMovement }}
        | population percent diff: {{ populationPercentDiff }}%
        | number of unchosen blocks: {{ numUnchosenBlocks }}
      pre
        | == Selected District ==
        | district: {{ seedIndex }}
        | target population: {{ districtInfo.targetPopulation }}
        | population: {{ districtInfo.population }}
        | needs: {{ districtInfo.targetPopulation - districtInfo.population }}
      pre(v-if="selectedBlock")
        | block ({{ selectedBlock.position.x }}, {{ selectedBlock.position.y }})
        | population: {{ selectedBlock.population }}
  .controls
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
      b-field
        b-button.is-warning(@click="restart", :loading="isWorking") Restart
      b-field
        b-switch(v-model="useTestData") Use Test Data
      b-field
        b-input(v-model="numBlocks", type="number")
    b-field(grouped)
      b-field(label="Number of Districts")
        b-input(v-model="numDistricts", type="number")

    b-field.is-marginless(grouped)
      b-field
        b-switch(v-model="useSorting") Use Sorting
      b-field
        b-switch(v-model="showAssignmentRegions") Show Assignment Regions
    b-field(grouped)
      b-field
        b-button(@click="selectBlocks", :loading="isWorking") Select Blocks
      b-field
        b-button(@click="adjustSeeds", :loading="isWorking") Adjust Seeds
      b-field
        b-button(@click="runUntilStable", :loading="isWorking") Stablize Seeds
      b-field
        b-button(@click="redistribute", :loading="isWorking") Redistribute
      b-field
        b-button.is-primary(@click="randomizeSeeds", :loading="isWorking") Reshuffle Seeds
    b-field(grouped)
      b-field
        b-button.is-primary.is-large(@click="run", :loading="isWorking") Redistrict!

  pre.status-log(ref="log") {{ statusLog }}
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
    , statusLog: ''

    , useTestData: true
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
    , blockStatistics: {}
  })
  , mounted(){
    this.init()
  }
  , computed: {
    isWorking(){ return this.working > 0 }
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
      if (this.working) return
      this.drawRegions()
    }
    , working: _throttle(function(working){
      this.loading = working > 0
    }, 200, { leading: false })
  }
  , methods: {
    log(msg){
      if ( msg === true ){
        msg = 'done\n'
      } else if ( msg === false ){
        msg = 'FAILED\n'
      }
      this.statusLog += msg
      let container = this.$refs.log
      container.scrollTop = container.scrollHeight
    }
    , async init(){
      this.working++
      const canvas = this.$refs.canvas
      this.redistricter = await new worker.Redistricter({
        blocks: 0 //this.numBlocks | 0
        , seedCount: this.numDistricts | 0
        , width: canvas.width
        , height: canvas.height
        , useSorting: this.useSorting
      })
      await this.restart()
      // await this.getOverlays()
      // await this.drawOverlays()
      this.working--
    }
    , async restart(){
      this.working++
      this.log('RESTART\n')
      await this.redistricter.setSeedCount(this.numDistricts | 0)

      if ( this.useTestData ){
        this.log('Initializing test blocks... ')
        await this.redistricter.useTestBlocks(this.numBlocks | 0)
      } else {
        this.log('Fetching Blocks... ')
        await this.redistricter.fetchBlocksFromShapefile(
          '/north-carolina/tabblock2010_37_pophu.shp'
          , { limit: -1 }
        )
      }

      this.log(true)

      this.blockStatistics = await this.redistricter.getBlockStats()

      this.log('Getting block coords... ')
      this.seedCoords = await this.redistricter.getSeedPositions()
      this.blocks = await this.redistricter.getBlocks()
      this.log(true)
      await this.drawRegions()
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
      this.working++
      this.log('Selecting blocks... ')
      this.overlays = null
      await this.redistricter.selectBlocks()
      await this.getInfo()
      this.log(true)
      if ( nodraw !== true ){
        await this.drawRegions()
      }
      this.working--
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
      this.working++
      this.log('Adjusting seed positions... ')
      this.seedMovement = await this.redistricter.adjustSeedPositions()
      this.seedCoords = await this.redistricter.getSeedPositions()
      this.blocks = await this.redistricter.getBlocks()
      this.log(true)
      if ( nodraw !== true ){
        await this.drawRegions()
      }
      this.working--
    }
    , async redistribute(){
      this.working++
      let popDiff = this.populationPercentDiff
      let lastDiffs = []
      const maxRounds = 100
      let round = 0
      while ((round++) < maxRounds){
        this.log(`Redistributing blocks (round ${round})...`)
        await this.redistricter.redistribute()
        await this.getInfo()
        popDiff = this.populationPercentDiff
        this.log(true)
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
      this.working--
    }
    , async drawRegions(){
      this.log('Drawing regions... ')
      if ( this.showAssignmentRegions ){
        this.regionsImage = await this.redistricter.getAssignmentMap()
      } else {
        this.regionsImage = await this.redistricter.getRegionMap()
      }

      this.drawImage(this.$refs.canvas, this.regionsImage)
      this.log(true)
    }
    , async drawPhiRegions(){
      this.working++
      this.log('Drawing phi regions... ')
      let voronoiImage = await this.redistricter.getPhiRegionMap()
      this.drawImage(this.$refs.canvas, voronoiImage)
      this.log(true)
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
      let start = Date.now()
      this.log('Starting redistrict process\n')
      await this.runUntilStable()
      await this.redistribute()
      let execTime = (Date.now() - start)/1000
      this.log(`Finished redistricting in ${execTime.toFixed(3)}s`)
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
    pointer-events: none
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
.status-log
  font-family: monospace
  border: 1px solid $grey
  border-radius: 3px
  margin: 1em 0
  height: 400px
  overflow-y: auto
  box-shadow: inset 0px 1px 5px black
</style>
