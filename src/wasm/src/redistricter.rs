use super::*;
use wasm_bindgen_futures::{JsFuture};
use wasm_bindgen::JsCast;
use web_sys::{Response};
use web_sys::console;
use geo::{Point, LineString, Coordinate, Rect};
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

fn distance_block_to_center(b : &BlockEntry, c: &Center) -> f64 {
  use geo::algorithm::euclidean_distance::EuclideanDistance;
  Point::from(c.coords).euclidean_distance(&Point::from(b.coords))
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

  pub fn new( state_code : u32 ) -> Self {
    use std::fs::File;
    use std::io::BufReader;

    let path = format!("../../public/block_data_state_{}.json", state_code);
    let file = File::open(path).unwrap();
    let reader = BufReader::new(file);

    let blocks : Vec<(f64, f64, u32)> = serde_json::from_reader(reader).unwrap();

    // get the bounding rect for these points
    let linestring = LineString(blocks.iter().map(|b| Coordinate { x: b.0, y: b.1 }).collect());
    let bounding_rect = linestring.bounding_rect().unwrap();

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

    this
  }

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

  pub fn find_assignment(&mut self) -> f32 {
    // https://github.com/aarroyoc/princeps/tree/master/simplex
    use simplex::{simplex};
    // https://docs.rs/ndarray/0.12.1/ndarray/doc/ndarray_for_numpy_users/index.html
    use ndarray::*;

    let n_blocks = self.num_blocks();
    let n_centers = self.num_centers();

    fn get_index(block_index : usize, center_index : usize) -> usize {
      block_index * center_index
    }

    let costs : Array1<f64> = self.blocks.iter()
      .enumerate()
      .flat_map(|(bi, b)| self.centers.iter().enumerate().map(
        move |(ci, c)| {
          let d = distance_block_to_center(b, c);
          d * d - c.weight
        }
      ))
      .into_iter().collect();

    let connections = Array::ones((1, n_centers));
    let reverse_connections = -Array2::eye(n_centers);
    let single_constraint = stack(Axis(0), &[connections.view(), reverse_connections.view()]).unwrap();

    let connection_constraints = stack(
      Axis(1),
      &vec![single_constraint.view(); n_blocks]
    ).unwrap();
    let all_constraints = stack(
      Axis(1),
      &[
        connection_constraints.view(),
        stack(Axis(0), &[
          Array::zeros((1, n_centers)).view(),
          Array2::eye(n_centers).view()]
        ).unwrap().view()
      ]
    ).unwrap();

    let mut caps = vec![(n_blocks / n_centers) as f64; n_centers];
    for i in 0..(n_blocks % n_centers) {
      caps[i] += 1.;
    }
    let requirements = arr1(&caps);

    // dbg!(&costs);
    // dbg!(&all_constraints);
    // dbg!(&requirements);

    let results = simplex(costs, all_constraints, requirements);

    dbg!(results.shape());

    1.
  }

  // pub fn find_assignment(&mut self) -> f32 {
  //   use std::collections::HashMap;
  //   use lp_modeler::dsl::*;
  //   use lp_modeler::solvers::{SolverTrait, GlpkSolver};
  //
  //   #[derive(Copy, Clone, PartialEq, Eq, Hash)]
  //   struct CenterIndex(usize);
  //   #[derive(Copy, Clone, PartialEq, Eq, Hash)]
  //   struct BlockIndex(usize);
  //
  //   let n_blocks = self.num_blocks();
  //   let n_centers = self.num_centers();
  //
  //   // set up the costs
  //   let costs: HashMap<(BlockIndex, CenterIndex), f32> = self.blocks.iter()
  //     .enumerate()
  //     .flat_map(|(bi, b)| self.centers.iter().enumerate().map(
  //       move |(ci, c)| {
  //         let d = distance_block_to_center(b, c);
  //         ((BlockIndex(bi), CenterIndex(ci)), (d * d - c.weight) as f32)
  //       }
  //     ))
  //     .into_iter().collect();
  //
  //   // Define Problem
  //   let mut problem = LpProblem::new("Assignment", LpObjective::Minimize);
  //
  //   // Define Variables
  //   let vars: HashMap<(BlockIndex, CenterIndex), LpBinary> =
  //     self.blocks.iter()
  //       .enumerate()
  //       .flat_map(|(bi, _b)| self.centers.iter().enumerate().map(
  //         move |(ci, _c)| {
  //           let key = (BlockIndex(bi), CenterIndex(ci));
  //           let value = LpBinary::new(&format!("{}_{}", bi, ci));
  //           (key, value)
  //         }))
  //       .collect();
  //
  //   // Define Objective Function
  //   let obj_vec: Vec<LpExpression> = {
  //     vars.iter().map( |(&(bi, ci), bin)| {
  //       let &coef = costs.get(&(bi, ci)).unwrap();
  //       coef * bin
  //     } )
  //   }.collect();
  //   problem += obj_vec.sum();
  //
  //
  //   // let sink_cap = n_blocks as i32; //(n_blocks as f64 / n_centers as f64).ceil() as i32;
  //   let mut caps = vec![(n_blocks / n_centers) as i32; n_centers];
  //   for i in 0..(n_blocks % n_centers) {
  //     caps[i] += 1;
  //   }
  //
  //   // Define Constraints
  //   // - constraint 1: Each block must be assigned to exactly one center
  //   for bi in 0..n_blocks {
  //     problem += sum(
  //       &(0..n_centers).into_iter().collect(),
  //       |&ci| vars.get(&(BlockIndex(bi), CenterIndex(ci))).unwrap()
  //     ).equal(1);
  //   }
  //
  //   // get the capacities of centers
  //   let mut caps = vec![(n_blocks / n_centers) as i32; n_centers];
  //   for i in 0..(n_blocks % n_centers) {
  //     caps[i] += 1;
  //   }
  //
  //   // - constraint 2: Each center must be assigned to exactly cap[ic] blocks
  //   for ci in 0..n_centers {
  //     problem += sum(
  //       &(0..n_blocks).into_iter().collect(),
  //       |&bi| vars.get(&(BlockIndex(bi), CenterIndex(ci))).unwrap()
  //     ).equal(caps[ci]);
  //   }
  //
  //   // Run Solver
  //   let solver = GlpkSolver::new();
  //   let result = solver.run(&problem);
  //
  //   assert!(result.is_ok(), result.unwrap_err());
  //
  //   let (status, solution) = result.unwrap();
  //   let mut total_cost = 0f32;
  //   for (&(bi, ci), var) in &vars{
  //     let cost = costs.get(&(bi, ci)).unwrap();
  //     let var_value = solution.get(&var.name).unwrap();
  //
  //     total_cost += cost * var_value;
  //   }
  //
  //   dbg!(status);
  //
  //   total_cost
  // }

  // pub fn find_assignment2(&mut self) {
  //   let n_blocks = self.num_blocks();
  //   let n_centers = self.num_centers();
  //   let block_offset = n_centers;
  //
  //   use geo::algorithm::euclidean_distance::EuclideanDistance;
  //   use mcmf::{GraphBuilder, Vertex, Cost, Capacity};
  //   let mut builder = GraphBuilder::new();
  //   for (ib, _b) in self.blocks.iter().enumerate() {
  //     // every block starts as a source
  //     builder.add_edge(Vertex::Source, block_offset + ib, Capacity(1), Cost(0));
  //   }
  //
  //   // let sink_cap = n_blocks as i32; //(n_blocks as f64 / n_centers as f64).ceil() as i32;
  //   let mut caps = vec![(n_blocks / n_centers) as i32; n_centers];
  //   for i in 0..(n_blocks % n_centers) {
  //     caps[i] += 1;
  //   }
  //
  //   for (ic, _c) in self.centers.iter().enumerate() {
  //     // every center is a sink
  //     builder.add_edge(ic, Vertex::Sink, Capacity(caps[ic]), Cost(0));
  //   }
  //
  //   for (ib, b) in self.blocks.iter().enumerate() {
  //     let block_point = Point::from(b.coords);
  //     let costs : Vec<f64> = self.centers.iter().map(|c| {
  //       let d : f64 = Point::from(c.coords).euclidean_distance(&block_point);
  //       d * d - c.weight
  //     }).collect();
  //
  //     // hack for floating points
  //     let min_cost = costs.iter().cloned().fold(0./0., f64::min);
  //     let costs : Vec<i32> = costs.iter().map(|c| (c / min_cost).ceil() as i32).collect();
  //
  //     for (ic, _c) in self.centers.iter().enumerate() {
  //       // path to every center
  //       builder.add_edge(block_offset + ib, ic, Capacity(1), Cost(costs[ic]));
  //     }
  //   }
  //
  //   let (cost, paths) = builder.mcmf();
  //
  //   let total_flow = paths.iter().fold(0, |t, p| {
  //     t + p.amount()
  //   });
  //
  //   dbg!(n_blocks);
  //   dbg!(total_flow);
  //
  //   dbg!(cost);
  // }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_flows() {
    use ndarray::{arr1, arr2};

    let objective = arr1(&[1., 2., 3., 4.]);
    let constraints = arr2(&[
      [1., 1., 1., 1.],
      [-1., 1., 1., 1.],
    ]);
    let requirements = arr1(&[30., 600.]);

    dbg!(&objective);
    dbg!(&constraints);
    dbg!(&requirements);
    let result = simplex::simplex(objective, constraints, requirements);
    println!("{:?}", result);

    let mut r = Redistricter::new(37);
    let result = r.find_assignment();
    // dbg!(result);
  }

  // #[test]
  // fn test_flows2() {
  //   let mut r = Redistricter::new(37);
  //   r.find_assignment2();
  // }
}
