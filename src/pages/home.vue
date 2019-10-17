<template lang="pug">
.home
  b-input(v-model="seedIndex", type="number", :loading="working")
  .canvas
    canvas(ref="canvas", width="500", height="500")
</template>

<script>
import _times from 'lodash/times'
import createWorker from '@/workers/main'
import Redistricter from '@/redistrict/redistricter'

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
      if ( Number.isFinite(index|0) ){
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

      await this.draw()
      this.working = false
    }
    , async draw(){
      this.working = true
      const canvas = this.$refs.canvas
      const ctx = canvas.getContext('2d')
      let regionData = await this.redistricter.getRankMapFor(this.seedIndex|0)
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
