import Vue from 'vue'
import App from '@/app'
import router from '@/router'
import Filters from '@/plugins/filters'
import Buefy from 'buefy'

import '@mdi/font/css/materialdesignicons.css'
// require styles
import './styles/main.scss'

Vue.use(Buefy, {
  defaultContainerElement: '#app'
  // , defaultIconPack: 'fas'
})

Vue.use(Filters)

Vue.config.productionTip = false

new Vue({
  render: h => h(App)
  , router
}).$mount('#app')
