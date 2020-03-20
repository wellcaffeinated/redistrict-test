import Vue from 'vue'
import Router from 'vue-router'
import Home from '@/pages/home'
import Redistricter from '@/pages/redistricter'
import WasmRedistricter from '@/pages/wasm-redistricter'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/'
      , name: 'home'
      , component: Home
    }
    , {
      path: '/wasm'
      , name: 'wasm'
      , component: WasmRedistricter
    }
    , {
      path: '/redistrict'
      , name: 'redistrict'
      , component: Redistricter
    }
    , {
      path: '*'
      , redirect: { name: 'home' }
    }
  ]
})
