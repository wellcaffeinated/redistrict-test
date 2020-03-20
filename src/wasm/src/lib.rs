extern crate wasm_bindgen;
#[allow(unused_imports)]
// #[macro_use]
// extern crate serde_derive;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC : wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn browser_debug() {
  // When the `console_error_panic_hook` feature is enabled, we can call the
  // `set_panic_hook` function at least once during initialization, and then
  // we will get better error messages if our code ever panics.
  //
  // For more details see
  // https://github.com/rustwasm/console_error_panic_hook#readme
  #[cfg(feature = "console_error_panic_hook")]
  console_error_panic_hook::set_once();
}

use wasm_bindgen_futures::{JsFuture};
use wasm_bindgen::JsCast;
use web_sys::{Response};
use web_sys::console;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
struct BlockEntry(f64, f64, u32);

#[wasm_bindgen]
pub struct Redistricter {
  canvas: web_sys::HtmlCanvasElement,
  ctx: web_sys::CanvasRenderingContext2d,
  blocks: Vec<BlockEntry>
}

#[wasm_bindgen]
impl Redistricter {

  // https://github.com/rustwasm/wasm-bindgen/issues/1858
  pub async fn create( canvas : web_sys::HtmlCanvasElement, state_code : u32 ) -> Result<Redistricter, JsValue> {

    let url = format!("/block_data_state_{}.json", state_code);
    let window = web_sys::window().unwrap();

    let resp_value = JsFuture::from(window.fetch_with_str(&url)).await?;

    let resp: Response = resp_value.dyn_into().unwrap();

      // Convert this other `Promise` into a rust `Future`.
    let json = JsFuture::from(resp.json()?).await?;

    let blocks : Vec<BlockEntry> = json.into_serde().unwrap();
    let first = &blocks[0];

    console::log_4(&"First Entry: ".into(), &first.0.into(), &first.1.into(), &first.2.into());

    let ctx = canvas
        .get_context("2d")
        .unwrap()
        .unwrap()
        .dyn_into::<web_sys::CanvasRenderingContext2d>()
        .unwrap();

    Ok(Self {
      canvas,
      ctx,
      blocks,
    })
  }

  pub fn draw(&self) {
    use std::f64::consts::PI;
    let context = &self.ctx;

    context
        .arc(75.0, 75.0, 50.0, 0.0, PI * 2.0)
        .unwrap();

    // Draw the mouth.
    context.move_to(110.0, 75.0);
    context.arc(75.0, 75.0, 35.0, 0.0, PI).unwrap();

    // Draw the left eye.
    context.move_to(65.0, 65.0);
    context
        .arc(60.0, 65.0, 5.0, 0.0, PI * 2.0)
        .unwrap();

    // Draw the right eye.
    context.move_to(95.0, 65.0);
    context
        .arc(90.0, 65.0, 5.0, 0.0, PI * 2.0)
        .unwrap();

    context.stroke();
  }
}
