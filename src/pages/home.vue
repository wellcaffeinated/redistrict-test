<template lang="pug">
.home
  .canvas
    b-loading(:active="working")
    canvas(ref="canvas", width="500", height="500", @mousemove="selectNearestIndex")
</template>

<script>
import _minBy from 'lodash/minBy'
import createWorker from '@/workers/main'
import Redistricter from '@/redistrict/redistricter'
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
    working: false
    , seedIndex: 0
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
  }
  , methods: {
    async init(){
      this.working = true
      const canvas = this.$refs.canvas
      this.redistricter = await new worker.Redistricter({
        blocks: 200
        , seedCount: 6
        , width: canvas.width
        , height: canvas.height
      })
      this.seedCoords = await this.redistricter.getSeedPositions()
      let images = []
      for (let i = 0; i < this.seedCoords.length; i++){
        let data = await this.redistricter.getRankMapFor(i)
        images.push(data)
      }
      this.images = images
      await this.draw()
      this.working = false
    }
    , selectNearestIndex(e){
      if ( !this.seedCoords ){ return }
      let x = e.layerX
      let y = e.layerY
      let seed = _minBy(this.seedCoords, s => distanceSq({x, y}, s))
      this.seedIndex = this.seedCoords.indexOf(seed)
    }
    , async draw(){
      this.working = true
      const canvas = this.$refs.canvas
      const ctx = canvas.getContext('2d')
      let regionData = this.images[this.seedIndex]
      ctx.putImageData(regionData, 0, 0)
      this.working = false
    }
  }
}
</script>

<style lang="sass" scoped>
.home
  padding: 1rem
canvas
  border: 1px solid rgba(255, 255, 255, 0.3)
</style>
