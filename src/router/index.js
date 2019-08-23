import Vue from 'vue'
import Router from 'vue-router'
import Home from '@/pages/home'
import Redistricter from '@/pages/redistricter'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/'
      , name: 'home'
      , component: Home
    }
    , {
      path: '/redistrict'
      , name: 'redistrict'
      , component: Redistricter
    }
    , {
      path: '*'
      , redirect: 'home'
    }
  ]
})
