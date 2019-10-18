<template lang="pug">
.home
  b-loading(:active="working > 0")
  .canvas
    canvas(ref="canvas", width="500", height="500")
    canvas(ref="canvasTop", width="500", height="500", @mousemove="selectNearestIndex", @mouseleave="seedIndex = -1")
  .controls
    b-field
      b-select(v-model="overlayMode")
        option(value="ranks") Rank maps
        option(value="phi") Phi maps
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
  })
  , mounted(){
    this.init()
  }
  , watch: {
    seedIndex(index){
      if ( Number.isFinite(index|0) && this.images ){
        this.draw()
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
        blocks: 200
        , seedCount: 6
        , width: canvas.width
        , height: canvas.height
      })
      this.seedCoords = await this.redistricter.getSeedPositions()
      this.regionsImage = await this.redistricter.getRegionMap()
      this.drawImage(this.$refs.canvas, this.regionsImage)
      await this.getOverlays()
      await this.draw()
      this.working--
    }
    , async getOverlays(){
      this.working++
      let fn = this.overlayMode === 'ranks' ? 'getRankMapFor' : 'getPhiMapFor'
      let images = []
      for (let i = 0; i < this.seedCoords.length; i++){
        let data = await this.redistricter[fn](i)
        images.push(data)
      }
      this.images = images
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
    , async draw(){
      if ( this.seedIndex < 0 ) {
        this.clearCanvas(this.$refs.canvasTop)
        return
      }
      this.working++
      this.drawImage(this.$refs.canvasTop, this.images[this.seedIndex])
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
