use super::*;
use wasm_bindgen_futures::{JsFuture};
use wasm_bindgen::JsCast;
use web_sys::{Response};
use web_sys::console;
use geo::{LineString, Coordinate, Rect};
use geo::algorithm::bounding_rect::BoundingRect;
use std::f64::consts::PI;

const PI2 : f64 = 2. * PI;

fn scale(min : f64, max : f64, z : f64) -> f64 {
  if min == max { return 1. }
  (z - min) / (max - min)
}

fn scale2d(from : &Rect<f64>, to : &Rect<f64>, p : &Coordinate<f64>) -> Coordinate<f64> {

  let x = scale(from.min.x, from.max.x, p.x) * to.max.x + to.min.x;
  let y = scale(from.min.y, from.max.y, p.y) * to.max.y + to.min.y;

  Coordinate {
    x, y
  }
}

fn draw_disc(context : &web_sys::CanvasRenderingContext2d, p : Coordinate<f64>, radius: f64, color : &JsValue){
  context.begin_path();
  context.set_fill_style(color);
  context.arc(p.x, p.y, radius, 0., PI2).unwrap();
  context.fill();
}

fn draw_circle(context : &web_sys::CanvasRenderingContext2d, p : Coordinate<f64>, radius: f64, color : &JsValue){
  context.begin_path();
  context.set_stroke_style(color);
  context.arc(p.x, p.y, radius, 0., PI2).unwrap();
  context.stroke();
}

fn get_random_coordinate(b : Rect<f64>) -> Coordinate<f64> {
  let x = b.width() * rand::random::<f64>() + b.min.x;
  let y = b.height() * rand::random::<f64>() + b.min.y;
  Coordinate { x, y }
}

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct BlockEntry {
  coords: (f64, f64),
  population: u32,
}

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct Center {
  coords: (f64, f64),
  weight: f64,
}

#[wasm_bindgen]
pub struct Redistricter {
  blocks: Vec<BlockEntry>,
  bounding_rect: Rect<f64>,
  num_centers: usize,
  centers: Vec<Center>,
}

#[wasm_bindgen]
impl Redistricter {

  // https://github.com/rustwasm/wasm-bindgen/issues/1858
  pub async fn create( state_code : u32 ) -> Result<Redistricter, JsValue> {

    let url = format!("/block_data_state_{}.json", state_code);
    let window = web_sys::window().unwrap();

    let resp_value = JsFuture::from(window.fetch_with_str(&url)).await?;

    let resp: Response = resp_value.dyn_into().unwrap();

      // Convert this other `Promise` into a rust `Future`.
    let json = JsFuture::from(resp.json()?).await?;

    let blocks : Vec<(f64, f64, u32)> = json.into_serde().unwrap();
    // get the bounding rect for these points
    let linestring = LineString(blocks.iter().map(|b| Coordinate { x: b.0, y: b.1 }).collect());
    let bounding_rect = linestring.bounding_rect().unwrap();

    let first = &blocks[0];
    console::log_4(&"First Entry: ".into(), &first.0.into(), &first.1.into(), &first.2.into());
    let mut this = Self {
      bounding_rect,
      num_centers: 5,
      centers: vec![],
      blocks: blocks.iter().map(|b| BlockEntry {
        coords: (b.0, b.1),
        population: b.2,
      }).collect(),
    };

    this.reset();

    Ok(this)
  }

  pub fn reset(&mut self){
    self.centers = vec![];
    for _i in 0..self.num_centers {
      self.centers.push(Center {
        coords: get_random_coordinate(self.bounding_rect).x_y(),
        weight: 0.,
      })
    }
  }

  fn to_canvas_coord(&self, canvas : &web_sys::HtmlCanvasElement, p : Coordinate<f64>) -> Coordinate<f64> {
    let w = canvas.width() as f64;
    let h = canvas.height() as f64;
    let canvas_rect = Rect::new(
      Coordinate { x: 0., y: 0. },
      Coordinate { x: w, y: h }
    );

    let mut c = scale2d(&self.bounding_rect, &canvas_rect, &p);
    c.y = h - c.y;
    c
  }

  pub fn width(&self) -> f64 {
    self.bounding_rect.width()
  }

  pub fn height(&self) -> f64 {
    self.bounding_rect.height()
  }

  pub fn set_num_centers(&mut self, n : usize){
    self.num_centers = n;
    self.reset();
  }

  pub fn num_blocks(&self) -> usize {
    self.blocks.len()
  }

  pub fn get_block(&self, n : usize) -> Option<BlockEntry> {
    self.blocks.get(n).map(|b| b.clone())
  }

  pub fn num_centers(&self) -> usize {
    self.centers.len()
  }

  pub fn get_centers(&self, n : usize) -> Option<Center> {
    self.centers.get(n).map(|b| b.clone())
  }

  pub fn draw_blocks(&self, context : &web_sys::CanvasRenderingContext2d) {
    let canvas = &context.canvas().unwrap();
    self.blocks.iter().for_each(|b| {
      let coord = self.to_canvas_coord(canvas, b.coords.into());
      draw_disc(context, coord, 1., &"#fff".into())
    });
  }

  pub fn draw_centers(&self, context : &web_sys::CanvasRenderingContext2d) {
    let canvas = &context.canvas().unwrap();
    self.centers.iter().for_each(|c| {
      let coord = self.to_canvas_coord(canvas, c.coords.into());
      draw_disc(context, coord, 3., &"#cc0000".into());
      draw_circle(context, coord, c.weight, &"#cc0000".into());
    });
  }
}
