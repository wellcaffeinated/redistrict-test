
export function scale(min, max, z){
  if (min === max){ return 1 }
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

class Branch {
  constructor(node){
    this.node = node
    this.branches = []
  }

  addBranch(node){
    let b = new Branch(node)
    this.branches.push(b)
    return b
  }

  climb(fn){
    fn(this)
    this.branches.forEach(b => b.climb(fn))
  }

  toArray(){
    let arr = []
    this.climb(b => {
      arr.push(b.node)
    })
    return arr
  }
}

export function Tree(node){
  return new Branch(node)
}

export function getBoundingBox(coords = []){
  const hasArrays = Array.isArray(coords[0])
  let x1 = Number.POSITIVE_INFINITY
  let x2 = Number.NEGATIVE_INFINITY
  let y1 = Number.POSITIVE_INFINITY
  let y2 = Number.NEGATIVE_INFINITY
  let l = coords.length
  let x
  let y

  for (let i = 0; i < l; i++){
    let p = coords[i]
    if ( hasArrays ){
      ([x, y] = p)
    } else {
      ({ x, y } = p)
    }

    x1 = Math.min(x1, x)
    x2 = Math.max(x2, x)
    y1 = Math.min(y1, y)
    y2 = Math.max(y2, y)
  }

  return {
    x1
    , x2
    , y1
    , y2
    , position: { x: x1, y: y1 }
    , width: x2 - x1
    , height: y2 - y1
  }
}
