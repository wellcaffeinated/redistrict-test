
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
