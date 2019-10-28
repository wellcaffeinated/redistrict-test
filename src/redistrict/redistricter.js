import { transfer } from 'comlink'
import _ from 'lodash'
import Voronoi from '@/lib/rhill-voronoi-core'
import concaveman from 'concaveman'
import chroma from 'chroma-js'
import {
  scale
  , Tree
  , getBoundingBox
} from '@/lib/util'
import {
  distance
  , distanceSq
  , getCentroid
  , getRandomPoints
  , RunningStatistics
  , rndSimpleGaussian
} from '@/lib/math'
import {
  setPixel
  , drawCircle
  , drawPolygon
} from '@/lib/draw'
import Block from './block'
import District from './district'
import { fetchBlockData } from './block-loader'

const colorBrew = 'BrBG'
const voronoi = new Voronoi()

function calcK(point, seeds){
  return _.sumBy(seeds, s => distanceSq(s, point))
}

// preference function
function calcPhi(blockPosition, seedPosition, K, w = 1){
  let d2 = distanceSq(blockPosition, seedPosition)
  return d2 + Math.sqrt(d2) - w * K
}

function getPhiRanksForPoint(point, seeds){
  let K = calcK(point, seeds)
  let phiRanks = seeds.map((s, index) => ({ phi: calcPhi(point, s, K), index }))
  return _.sortBy(phiRanks, 'phi')
}

function getRegionIndex(point, seeds){
  let phiRanks = getPhiRanksForPoint(point, seeds)
  return phiRanks[0].index
}

function rankOfPoint(point, index, seeds){
  let phiRanks = getPhiRanksForPoint(point, seeds)
  return _.findIndex(phiRanks, { index })
}

function getRandomCensusBlocks(n, width, height, ruralPop = 10, cityPop = 400){
  const dev = (cityPop + ruralPop) / 6
  let cities = getRandomPoints(10, width, height)
  let statistics = RunningStatistics()

  let blockData = getRandomPoints(n, width, height).map( position => {
    let nearest = _.minBy(cities, s => distanceSq(position, s))
    let distToCity = distance(nearest, position)
    let meanPop = ruralPop + scale(width/4, 0, distToCity) * (cityPop - ruralPop)
    let population = Math.max(rndSimpleGaussian(meanPop, dev), 0) | 0

    statistics.push(population)

    return {
      position
      , population
    }
  })

  return {
    statistics
    , blockData
  }
}

function projectionMap(point, from, to){
  return {
    x: scale(from.x1, from.x2, point.x) * to.x2 + to.x1
    , y: scale(from.y1, from.y2, point.y) * to.y2 + to.y1
  }
}

function drawDistrictBlocks(ctx, district, color, populationColorScale, pointMap){
  _.forEach(district.pools[0], entry => {
    let pos = pointMap(entry.block.position)
    let color = populationColorScale ? populationColorScale(entry.block.population) : 'rgba(0, 0, 0, 0.8)'
    drawCircle(ctx, pos, 1, color)
  })
  _.forEach(district.claimed, entry => {
    let pos = pointMap(entry.block.position)
    drawCircle(ctx, pos, 1, color)
  })
}

export class Redistricter {
  constructor({ blocks, seedCount, width, height, useSorting }){
    this.width = width
    this.height = height
    this.seedCount = seedCount
    this.preferenceFunction = calcPhi
    this.enableSorting(useSorting)

    this.imageBounds = {
      x1: 0
      , y1: 0
      , x2: width
      , y2: height
      , width
      , height
    }

    if ( Number.isFinite(blocks) ){
      // for testing...
      this.useTestBlocks(blocks)
    } else {
      this.blockData = blocks || []
      this.blockStatistics = RunningStatistics()
      blocks.forEach(b => this.blockStatistics.push(b.population))
      this.bounds = this.getBlockDataBounds(this.blockData)
      this.randomizeSeeds()
    }
  }

  setSeedCount(n){
    this.seedCount = n
  }

  getBlockStats(){
    return this.blockStatistics.toObject()
  }

  useTestBlocks(n){
    let result = getRandomCensusBlocks(n, this.width, this.height)
    this.blockStatistics = result.statistics
    this.blockData = result.blockData
    this.bounds = this.getBlockDataBounds(this.blockData)
    this.randomizeSeeds()
  }

  getBlockDataBounds(blockData){
    return getBoundingBox(blockData.map(b => b.position))
  }

  async fetchBlocksFromShapefile(url, options){
    let result = await fetchBlockData(url, options)
    this.blockStatistics = result.statistics
    this.blockData = result.blockData
    this.bounds = this.getBlockDataBounds(this.blockData)
    // console.log(this.bounds)
    console.log(`fetched ${result.statistics.size()} blocks with total population ${result.statistics.sum()}`)
    // console.log(this.blockData)
    this.randomizeSeeds()
  }

  enableSorting(flag = true){
    this.useSorting = flag
  }

  randomizeSeeds(){
    this.seeds = getRandomPoints(this.seedCount, this.bounds)
    this.restart()
  }

  restart(){
    this.blocks = this.blockData.map(data => new Block({
      position: data.position
      , population: data.population
      , seeds: this.seeds
      , calcPhi: this.preferenceFunction
    }))
    this.totalPopulation = this.blockStatistics.sum()

    this.initDistricts()
  }

  adjustSeedPositions(){
    let newSeeds = _.map(this.districts, (district, i) => {
      let points = []
      let weights = []
      district.claimed.forEach(entry => {
        points.push(entry.block.position)
        weights.push(entry.block.population)
        entry.block.district = null
      })
      if (!points.length){ return district.position }
      return getCentroid(points, weights)
    })

    let seedMovement = _.max(_.map(newSeeds, (s, i) => {
      return distance(s, this.seeds[i])
    }))

    this.seeds = newSeeds
    this.restart()
    return seedMovement
  }

  initDistricts(){
    let targetPopulation = Math.floor(this.totalPopulation / this.seedCount)
    let remainder = this.totalPopulation % this.seedCount
    this.districts = this.seeds.map((position, index) => {
      let fudge = Math.max(0, remainder--) && 1
      return new District({
        position
        , index
        , targetPopulation: targetPopulation + fudge
        , blocks: this.blocks
        , useSorting: this.useSorting
      })
    })
  }

  selectBlocks(){
    _.forEach(this.districts, district => {
      district.selectBlocksWithinRegion()
    })
  }

  getRedistributionTree(){
    const added = []
    const remaining = [].concat(this.districts)
    const first = _.maxBy(remaining, 'population')
    const tree = Tree(first)
    _.pull(remaining, first)
    added.push(tree)
    let branch = tree

    while ( remaining.length ){
      // get next nearest
      let next = _.minBy(remaining, d => distanceSq(d.position, branch.node.position))
      // remove it
      _.pull(remaining, next)
      // see which previous branch it's closest to
      branch = _.minBy(added, b => distanceSq(b.node.position, next.position))
      branch = branch.addBranch(next)
      added.push(branch)
    }

    return tree
  }

  redistribute(){
    this.districts.forEach(d => d.selectBlocksWithinRegion(true))
    const tree = this.getRedistributionTree()

    tree.climb(branch => {
      let district = branch.node
      if ( !branch.branches.length ){ return }

      while (district.neededPopulation() < 0){
        branch.branches.forEach(b => {
          district.giveBlock(b.node)
        })
      }
    })

    return true
  }

  getSeedPositions(){
    return this.seeds
  }

  getBlocks(){
    return this.blockData
  }

  getNumUnchosenBlocks(){
    let claimed = _.sumBy(this.districts, d => {
      return d.claimed.length
    })

    return this.blocks.length - claimed
  }

  getMaxPopulationDifferencePercentage(districts){
    districts = districts || this.districts
    let min = _.minBy(districts, 'population').population
    let max = _.maxBy(districts, 'population').population

    return 100 * (max - min) / (0.5 * (max + min))
  }

  getDistrict(index){
    return _.omitBy(_.omit(this.districts[index], ['blocks', 'claimed', 'pools']), _.isFunction)
  }

  //
  // Drawing...
  //

  toCanvasPoint(p){
    return projectionMap(p, this.bounds, this.imageBounds)
  }

  getPhiMapFor(index){
    const regionColors = chroma.scale(colorBrew).colors(this.seedCount, 'rgba')
    const width = this.width
    const height = this.height
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')

    let points = []
    let phiStats = RunningStatistics()

    for (let y = 0; y < height; y++){
      for (let x = 0; x < width; x++){
        let p = {x, y}
        let phis = getPhiRanksForPoint(p, this.seeds)
        let rank = _.findIndex(phis, { index })
        let phi = phis[rank].phi
        points.push({ point: p, phi, index: phis[0].index, rank })
        phiStats.push(phi)
      }
    }

    let scale = chroma.scale(['rgba(0, 0, 0, 0.8)', 'rgba(255,255,255,0.8)'])

    for (let i = 0, l = points.length; i < l; i++){
      let { rank, phi, point, index } = points[i]
      let stats = phiStats
      let range = stats.min() - stats.max()
      let alpha = (phi - stats.max())/range
      let color = scale(alpha)

      let p = this.toCanvasPoint(point)
      setPixel(ctx, p.x, p.y, color.css())
    }

    this.seeds.forEach( (s, i) =>
      drawCircle(ctx, this.toCanvasPoint(s), 5, regionColors[i].css())
    )

    let data = ctx.getImageData(0, 0, width, height)
    return transfer(data, [data.data.buffer])
  }

  getRankMapFor(index){
    const regionColors = chroma.scale(colorBrew).colors(this.seedCount, 'rgba')
    const width = this.width
    const height = this.height
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')

    let points = []
    let phiStats = RunningStatistics()

    for (let y = 0; y < height; y++){
      for (let x = 0; x < width; x++){
        let p = {x, y}
        let phis = getPhiRanksForPoint(p, this.seeds)
        let rank = _.findIndex(phis, { index })
        let phi = phis[rank].phi
        points.push({ point: p, phi, index: phis[0].index, rank })
        phiStats.push(phi)
      }
    }

    let scales = regionColors.map(c => this.seeds.map((s, r) => {
      let col = c.darken(r)
      return chroma.scale([col, col.luminance(1)])
    }))

    for (let i = 0, l = points.length; i < l; i++){
      let { rank, phi, point, index } = points[i]
      let stats = phiStats
      let range = stats.min() - stats.max()
      let alpha = (phi - stats.max())/range
      // let color = regionColors[index].luminance(alpha).darken(rank)
      let scale = scales[index][rank]
      let color = scale(alpha)
      let p = this.toCanvasPoint(point)
      setPixel(ctx, p.x, p.y, color.css())
    }

    // const colors = colorScale.colors(this.seedCount, 'rgba')
    //
    // for (let y = 0; y < height; y++){
    //   for (let x = 0; x < width; x++){
    //     let p = {x, y}
    //     let rank = rankOfPoint(p, index, this.seeds)
    //     let color = colors[rank]
    //     setPixel(ctx, x, y, color.css())
    //   }
    // }

    this.seeds.forEach( (s, i) =>
      drawCircle(ctx, this.toCanvasPoint(s), 5, regionColors[i].css())
    )

    let data = ctx.getImageData(0, 0, width, height)
    return transfer(data, [data.data.buffer])
  }

  getPhiRegionMap(){
    const colorScale = chroma.scale(colorBrew)
    const width = this.width
    const height = this.height
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')

    const colors = colorScale.colors(this.seedCount, 'rgba')

    let points = []
    let phiStats = _.times(this.seedCount, () => RunningStatistics())

    for (let y = 0; y < height; y++){
      for (let x = 0; x < width; x++){
        let p = {x, y}
        let phis = getPhiRanksForPoint(p, this.seeds)
        let { index, phi } = phis[0]
        points.push({ point: p, phi, index })
        phiStats[index].push(phi)
      }
    }

    let scales = colors.map(c => chroma.scale([c, c.luminance(1)]))
    for (let i = 0, l = points.length; i < l; i++){
      let { index, phi, point } = points[i]
      let stats = phiStats[index]
      let range = stats.min() - stats.max()
      let alpha = (phi - stats.max())/range
      let color = scales[index](alpha) // colors[index].luminance(alpha)
      let p = this.toCanvasPoint(point)
      setPixel(ctx, p.x, p.y, color.css())
    }

    this.drawBlocksAndSeeds(ctx, colors, false, true)

    let data = ctx.getImageData(0, 0, width, height)
    return transfer(data, [data.data.buffer])
  }

  getRegionMap(){
    const colorScale = chroma.scale(colorBrew)
    const width = this.width
    const height = this.height
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')

    const colors = colorScale.colors(this.seedCount, 'rgba')

    // WTF isn't this working
    // let canvasScale = Math.min(this.imageBounds.width, this.imageBounds.height)
    // let dim = Math.max(this.bounds.width, this.bounds.height)
    // canvasScale /= dim
    // let xt = dim/2 + this.bounds.x1
    // let yt = dim/2 + this.bounds.y1
    // ctx.transform(1, 0, 0, 1, canvasScale * xt, canvasScale * yt)
    // ctx.transform(canvasScale, 0, 0, -canvasScale, 0, 0)
    // ctx.transform(1, 0, 0, 1, -xt - this.bounds.x1, -yt + this.bounds.y1)

    const bbox = {
      xl: this.bounds.x1
      , yt: this.bounds.y1
      , xr: this.bounds.x2
      , yb: this.bounds.y2
    }

    const sites = this.seeds.map(_.clone)
    let diagram = voronoi.compute(sites, bbox)

    for (let i = 0, l = this.seedCount; i < l; i++) {
      let cell = diagram.cells[sites[i].voronoiId]
      if (cell) {
        let halfedges = cell.halfedges
        let length = halfedges.length
        if (length > 2) {
          let points = []
          for (let j = 0; j < length; j++) {
            let v = halfedges[j].getEndpoint()
            points.push(v)
          }

          drawPolygon(ctx, points.map(p => this.toCanvasPoint(p)), colors[i].css())
        }
      }
    }

    this.drawBlocksAndSeeds(ctx, colors, true)

    let data = ctx.getImageData(0, 0, width, height)
    return transfer(data, [data.data.buffer])
  }

  getAssignmentMap(){
    const colorScale = chroma.scale(colorBrew)
    const width = this.width
    const height = this.height
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')

    const colors = colorScale.colors(this.seedCount, 'rgba')

    this.districts.forEach( (d, i) => {
      let blockLocations = d.claimed.map(entry => [entry.block.position.x, entry.block.position.y])
      if ( !blockLocations.length ){ return }
      let shape = concaveman(blockLocations)
      let polygon = shape.map(([x, y]) => this.toCanvasPoint({x, y}))
      drawPolygon(ctx, polygon, colors[i].css())
    })

    // this.drawBlocksAndSeeds(ctx, colors, true)
    this.drawSeeds(ctx, colors, true)

    let data = ctx.getImageData(0, 0, width, height)
    return transfer(data, [data.data.buffer])
  }

  drawSeeds(ctx, colors, useHighlightColors){
    let blockColors = colors.map(color => {
      if ( !useHighlightColors ){ return color.css() }
      if ( color.get('lab.l') > 50 ){
        return color.darken(2).css()
      } else {
        return color.brighten(2).css()
      }
    })

    this.districts.forEach( (d, i) => {
      let pos = this.toCanvasPoint(d.position)
      let color = blockColors[i]

      drawCircle(ctx, pos, 7, d.population >= d.targetPopulation ? 'white' : 'black')
      drawCircle(ctx, pos, 5, color)
    })
  }

  drawBlocksAndSeeds(ctx, colors, useHighlightColors, usePopulationColorScale){
    let populationColorScale = false

    if ( usePopulationColorScale ){
      let maxPopulation = this.blockStatistics.max()
      populationColorScale = chroma.scale(['rgba(255,255,255,0.4)', 'red']).mode('lab').domain([0, maxPopulation])
    }

    let blockColors = colors.map(color => {
      if ( !useHighlightColors ){ return color.css() }
      if ( color.get('lab.l') > 50 ){
        return color.darken(2).css()
      } else {
        return color.brighten(2).css()
      }
    })

    this.districts.forEach( (d, i) => {
      let color = blockColors[i]
      drawDistrictBlocks(ctx, d, color, populationColorScale, this.toCanvasPoint.bind(this))
    })

    this.districts.forEach( (d, i) => {
      let pos = this.toCanvasPoint(d.position)
      let color = blockColors[i]

      drawCircle(ctx, pos, 7, d.population >= d.targetPopulation ? 'white' : 'black')
      drawCircle(ctx, pos, 5, color)
    })
  }
}
