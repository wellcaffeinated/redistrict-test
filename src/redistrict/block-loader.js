import * as shapefile from 'shapefile'
import {
  getCentroid
  , RunningStatistics
} from '@/lib/math'

export async function fetchBlockData( url, { populationField = 'POP10', limit = -1 } = {} ){
  let statistics = RunningStatistics()
  let source = await shapefile.open(url, null, { crossorigin: true })
  let blockData = []
  let result
  while (result = await source.read()){
    if (result.done){ break }
    if (limit > 0 && statistics.size() >= limit){ break }

    let population = result.value.properties[populationField]
    if (!population){ continue }

    statistics.push(population)

    let shape = result.value.geometry
    if ( shape.type === 'MultiPolygon'){
      // weird case for blocks that have multiple polygons
      shape = shape.coordinates[0][0]
      console.log('Warning: multipolygon reduced to first polygon for', result.value)
    } else {
      shape = shape.coordinates[0]
    }

    let position = getCentroid(shape)

    blockData.push({
      position
      , population
    })
  }

  return {
    statistics
    , blockData
  }
}
