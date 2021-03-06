const path = require('path')
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin')

module.exports = {
  publicPath: process.env.NODE_ENV === 'production'
    ? '/redistrict-test/'
    : '/'
  , chainWebpack: config => {
    if ( process.env.NODE_ENV === 'production' ){
      config.plugin('copy').tap(options => {
        options[0][0].ignore.push('data/**/*')
        return options
      })
    }
  }
  , configureWebpack: {
    resolve: { symlinks: false }
    , node: {
      __dirname: true
    }
    , plugins: [
  		new WasmPackPlugin({
          crateDirectory: path.resolve(__dirname, 'src/wasm')
          , watchDirectories: [
            path.resolve(__dirname, 'src/wasm/src')
          ]
          , forceMode: 'production'
      })
  	]
    , output: {
      globalObject: 'this'
    }
    , module: {
      rules: [
        {
          test: /\.js$/
          , use: [
            'comlink-loader'
          ]
          , include: [ path.resolve(__dirname, 'src/workers') ]
        }
      ]
    }
  }
  , css: {
    loaderOptions: {
      // pass options to sass-loader
      sass: {
        data: `@import '@/styles/_variables.scss'`
      }
    }
  }
}
