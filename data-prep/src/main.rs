use std::fs::File;
use serde::{Serialize, Deserialize};
use std::env;
use std::collections::HashMap;
use shapefile::{
  dbase::FieldValue,
  record::{Shape, poly::Polygon}
};
// use rustbreak::Database;
use indicatif::ProgressBar;

#[derive(Debug, Serialize, Deserialize)]
struct BlockEntry(f64, f64, u32);

fn get_centroid(polygon : Polygon) -> (f64, f64) {
  let mut x = 0.;
  let mut y = 0.;
  let l = polygon.points.len() as f64;

  if l == 0. {
    return (x, y);
  }

  for p in polygon.points {
    x += p.x;
    y += p.y;
  }

  x /= l;
  y /= l;

  return (x, y);
}

fn get_block_entry(polygon : Polygon, record : HashMap<std::string::String, FieldValue>) -> BlockEntry {
  let (x, y) = get_centroid(polygon);

  if let FieldValue::Numeric(Some(population)) = &record["POP10"] {
    BlockEntry(x, y, *population as u32)
  } else {
    panic!("Block has no population field!");
  }
}

fn main() -> std::io::Result<()> {
  let args : Vec<String> = env::args().collect();
  if args.len() < 2 {
    println!("Please provide a shapefile as the first argument");
    return Ok(());
  }

  let reader = shapefile::Reader::from_path(&args[1]).unwrap();
  let mut iter = reader.iter_shapes_and_records().unwrap().peekable();

  let state_code;
  {
    let result = iter.peek();
    let (_shape, record) = result.unwrap().as_ref().unwrap();

    if let FieldValue::Character(Some(code)) = &record["STATEFP10"] {
      state_code = code;
    } else {
      panic!("Data malformed");
    };
  }

  // let db = Database::<usize>::open(format!("block_data_state_{}", state_code)).unwrap();
  let outfile = File::create(format!("block_data_state_{}.json", state_code))?;
  let mut entries = Vec::new();

  // store the block entries as this more readable format
  let spinner = ProgressBar::new_spinner();
  spinner.enable_steady_tick(100);
  for (n, result) in iter.enumerate() {
    let (shape, record) = result.unwrap();

    spinner.set_message(&format!("{} blocks read", n));

    if let Shape::Polygon(s) = shape {
      let entry = get_block_entry(s, record);
      // we don't need entries with no population
      if entry.2 > 0 {
        entries.push(entry);
        // db.insert(&n, entry).unwrap();
      }
    } else {
      println!("Stopped early! Found something that is not a polygon: {}", shape);
      return Ok(());
    }
  }

  // db.flush().unwrap();
  serde_json::to_writer(outfile, &entries)?;

  spinner.finish();
  println!("Done!");

  Ok(())
}
