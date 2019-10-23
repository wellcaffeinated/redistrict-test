export function setPixel(ctx, x, y, color = 'white'){
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, 1)
}

export function drawCircle(ctx, {x, y}, radius, color = 'white'){
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, 2 * Math.PI, false)
  ctx.fillStyle = color
  ctx.fill()
}

export function drawPolygon(ctx, points, color = 'white'){
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 0
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1, l = points.length; i < l; i++){
    let { x, y } = points[i]
    ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.fill()
}
