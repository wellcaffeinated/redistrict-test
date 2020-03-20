use serde::{Serialize, Deserialize};
use std::f64::{INFINITY, NEG_INFINITY};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RunningStatisticsResults {
  mean : f64,
  deviation: f64,
  sum : f64,
  size : usize,
  max : f64,
  min : f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RunningStatistics {
  m : f64,
  s : f64,
  n : usize,
  total : f64,
  _max : f64,
  _min : f64,
}

impl RunningStatistics {
  pub fn new() -> Self {
    Self {
      m: 0.,
      s: 0.,
      n: 0,
      total: 0.,
      _max: NEG_INFINITY,
      _min: INFINITY,
    }
  }

  pub fn push(&mut self, v : f64){
    self.n += 1;
    let x = v - self.m;

    // Mk = Mk-1 + (xk – Mk-1)/k
    // Sk = Sk-1 + (xk – Mk-1)*(xk – Mk).
    self.m += x / self.n as f64;
    self.s += x * (v - self.m);

    // max / min
    self._max = v.max(self._max);
    self._min = v.min(self._min);
    self.total += v;
  }

  pub fn mean(&self) -> f64 { self.m }
  pub fn variance(&self) -> f64 { if self.n <= 1 { 0. } else { self.s / ((self.n - 1) as f64) } }
  pub fn deviation(&self) -> f64 { self.variance().sqrt() }
  pub fn max(&self) -> f64 { self._max }
  pub fn min(&self) -> f64 { self._min }
  pub fn sum(&self) -> f64 { self.total }
  pub fn size(&self) -> usize { self.n }
  pub fn as_results(&self) -> RunningStatisticsResults {
    RunningStatisticsResults {
      mean: self.mean(),
      deviation: self.deviation(),
      sum: self.sum(),
      size: self.size(),
      max: self.max(),
      min: self.min(),
    }
  }
}
