export function setPixel(ctx, x, y, color = 'white'){
  if ( ctx.fillStyle !== color ){
    ctx.fillStyle = color
  }
  ctx.fillRect(x, y, 1, 1)
}

export function drawCircle(ctx, {x, y}, radius, color = 'white'){
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, 2 * Math.PI, false)
  if ( ctx.fillStyle !== color ){
    ctx.fillStyle = color
  }
  ctx.fill()
}

export function drawPolygon(ctx, points, color = 'white'){
  const hasArrays = Array.isArray(points[0])
  if ( ctx.fillStyle !== color ){
    ctx.fillStyle = color
  }
  if ( ctx.strokeStyle !== color ){
    ctx.strokeStyle = color
    ctx.lineWidth = 0
  }
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1, l = points.length; i < l; i++){
    if ( hasArrays ){
      let [ x, y ] = points[i]
      ctx.lineTo(x, y)
    } else {
      let { x, y } = points[i]
      ctx.lineTo(x, y)
    }
  }
  ctx.closePath()
  ctx.stroke()
  ctx.fill()
}
