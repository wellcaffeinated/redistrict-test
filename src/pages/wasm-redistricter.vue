<template lang="pug">
.wrap
  h2.title Wasm Redistricter
  canvas(ref="canvas", width="500", height="500")
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
    let r = this.redistricter = await wasm.Redistricter.create(this.$refs.canvas, 27)
    r.draw()
  }
  , watch: {
  }
  , methods: {
  }
}
</script>

<style lang="sass" scoped>
</style>
