<template lang="pug">
.home
  b-button(@click="generate", :loading="working") Generate
  .canvas
    canvas(ref="canvas", width="500", height="500")
</template>

<script>
import _times from 'lodash/times'
import createWorker from '@/workers/main'

const worker = createWorker()

export default {
  name: 'Home'
  , props: {
  }
  , components: {
  }
  , data: () => ({
    working: false
    , seeds: []
  })
  , mounted(){
  }
  , watch: {
    seeds(){
      const canvas = this.$refs.canvas
      const ctx = canvas.getContext('2d')
      this.working = true
      worker.getImageData(canvas.width, canvas.height, this.seeds).then( data => {
        ctx.putImageData(data, 0, 0)
      }).finally(() => {
        this.working = false
      })
    }
  }
  , methods: {
    generate(){
      const canvas = this.$refs.canvas
      this.seeds = _times(10).map(n => {
        let x = Math.random() * canvas.width
        let y = Math.random() * canvas.height
        return { x, y }
      })
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
