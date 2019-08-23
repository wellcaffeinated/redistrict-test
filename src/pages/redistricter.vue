<template lang="pug">
.wrap
  b-field(grouped)
    b-field
      b-button(@click="run", :loading="working") Run
    b-field
      b-button(@click="step", :loading="working") Step
  .canvas
    canvas(ref="regionCanvas", width="500", height="500")
    canvas(ref="canvas", width="500", height="500")
</template>

<script>
import _times from 'lodash/times'
import createWorker from '@/workers/main'

const worker = createWorker()

export default {
  name: 'Redistricter'
  , props: {
  }
  , components: {
  }
  , data: () => ({
    working: false
    , redistricter: null
  })
  , mounted(){
    this.working = true
    this.initRedistricter().then(() => {
      return this.drawRegions()
    }).catch(e => {
      console.error(e)
    }).finally(() => {
      this.working = false
    })
  }
  , watch: {
  }
  , methods: {
    async initRedistricter(){
      const canvas = this.$refs.canvas
      const width = canvas.width
      const height = canvas.height

      this.redistricter = await new worker.Redistricter({
        seedCount: 10
        , blockCount: 500
        , width
        , height
      })

      await this.draw()
    }
    , async drawRegions(){
      const canvas = this.$refs.regionCanvas
      const ctx = canvas.getContext('2d')
      const width = canvas.width
      const height = canvas.height
      let regionData = await worker.getImageData(canvas.width, canvas.height, await this.redistricter.getSeedPositions())
      ctx.putImageData(regionData, 0, 0)
    }
    , async draw(){
      const canvas = this.$refs.canvas
      const ctx = canvas.getContext('2d')

      let data = await this.redistricter.getImageData()
      ctx.putImageData(data, 0, 0)
    }
    , async run(){
      while ( !await this.redistricter.isDone() ){
        this.step()
      }
    }
    , async step(){
      await this.redistricter.step()
      await this.draw()
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
</style>
