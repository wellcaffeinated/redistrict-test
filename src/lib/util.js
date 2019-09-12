
export function scale(min, max, z){
  return (z - min) / (max - min)
}

export function indexWithLowestValue( arr ){
  let lowestIndex = -1
  let lowestValue
  arr.forEach( (v,i) => {
    if ( lowestValue === undefined || lowestValue > v ){
      lowestValue = v
      lowestIndex = i
    }
  })
  return lowestIndex
}
