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
