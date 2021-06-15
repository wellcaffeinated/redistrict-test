<template lang="pug">
.wrap
  h2.title Wasm Redistricter
  .viewport(ref="viewport")
    canvas(ref="canvas")
</template>

<script>
// import createWorker from '@/workers/wasm-worker'
// import _times from 'lodash/times'
const app = import('@/wasm/pkg/app')
app.then( mod => mod.browser_debug() )

export default {
  name: 'WasmRedistricter'
  , props: {
  }
  , components: {
  }
  , data: () => ({
  })
  , async mounted(){
    const wasm = await app
    let r = this.redistricter = await wasm.Redistricter.create(37)
    let s = r.height() / r.width()
    let width = this.$refs.viewport.offsetWidth
    let canvas = this.$refs.canvas
    canvas.width = width
    canvas.height = width * s
    let ctx = canvas.getContext('2d')
    r.draw_blocks(ctx)
    r.draw_centers(ctx)
    // let flows = r.find_assignment()
    // console.log(flows)
  }
  , watch: {
  }
  , methods: {
  }
}
</script>

<style lang="sass" scoped>
.wrap
  padding: 2em
.viewport
  width: 100vw
  canvas
    width: 100%
</style>
