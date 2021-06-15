// Based on https://github.com/splintersu/NetworkSimplex

use num_traits::Zero;

type NodeIndex = usize;
type ArcIndex = usize;

#[derive(Clone, Default)]
struct TreeNode {
  pub dep : NodeIndex,
  pub parent : Option<NodeIndex>,
  pub arc_to_parent : Option<ArcIndex>,
}

struct Tree<T> {
  // prices??
  pub costs : Vec<T>,
  pub nodes : Vec<TreeNode>,
}

impl<T> Tree<T>
where T : Zero, T: std::clone::Clone {
  pub fn new( size : usize ) -> Self {
    Self {
      costs: vec![T::zero(); size],
      nodes: vec![TreeNode::default(); size],
    }
  }

  pub fn clear(&mut self) {
    self.costs[0] = T::zero();
    self.nodes[0].dep = 1;
    self.nodes[0].parent = None;
    self.nodes[0].arc_to_parent = None;
  }

  pub fn traverse<F>(&self, start : ArcIndex, end : ArcIndex, mut func : F)
  where F : FnMut(ArcIndex) -> () {
    let nodes = &self.nodes;
    let mut start = start;
    let mut end = end;

    while nodes[start].dep > nodes[end].dep {
			func(nodes[start].arc_to_parent.unwrap());
			start = nodes[start].parent.unwrap();
		}
		while nodes[start].dep < nodes[end].dep {
			func(nodes[end].arc_to_parent.unwrap() ^ 1);
			end = nodes[end].parent.unwrap();
		}
		while start != end {
			func(nodes[start].arc_to_parent.unwrap());
			func(nodes[end].arc_to_parent.unwrap() ^ 1);
			start = nodes[start].parent.unwrap();
			end = nodes[end].parent.unwrap();
		}
  }
}

// struct TreeIterator<'a, T> {
//   up : bool,
//   down: bool,
//   start : ArcIndex,
//   end : ArcIndex,
//   tree : &'a Tree<T>,
// }
//
// impl<'a, T> TreeIterator<'a, T> {
//   pub fn new(tree : &'a Tree<T>, start : ArcIndex, end : ArcIndex) -> Self {
//     Self {
//       tree,
//       start,
//       end,
//       up : true,
//       down: true,
//     }
//   }
// }
//
// impl<T> Iterator for TreeIterator<'_, T> {
//   type Item = ArcIndex;
//   fn next(&mut self) -> Option<Self::Item> {
//     let at_start = &self.tree.nodes[self.start];
//     let at_end = &self.tree.nodes[self.end];
//
//     if self.up {
//       let next = at_start.parent;
//       self.start = next;
//
//       if self.tree.nodes[self.start].dep <= at_end.dep {
//         self.up = false;
//       }
//
//       return Some(at_start.arc_to_parent);
//     }
//
//     if self.down {
//       let next = at_end.parent;
//       self.end = next;
//
//       if at_start.dep >= self.tree.nodes[self.end].dep {
//         self.down = false;
//       }
//
//       return Some(at_end.arc_to_parent ^ 1);
//     }
//
//     if self.start != self.end {
//
//     }
//
//     None
//   }
// }

enum UnionResult {
  NotCycle,
  Cycle,
}

struct UnionFindSet {
  set_map : Vec<Option<usize>>,
}

impl UnionFindSet {
  pub fn new(size : usize) -> Self {
    Self {
      set_map : vec![None; size],
    }
  }

  pub fn find(&mut self, idx : usize) -> usize {
    if let Some(new_idx) = self.set_map[idx] {
      let res = self.find(new_idx);
      self.set_map[idx] = Some(res);
      res
    } else {
      idx
    }
  }

  pub fn union(&mut self, a : usize, b : usize) -> UnionResult {
    let res_a = self.find(a);
    let res_b = self.find(b);

    if res_a == res_b {
      UnionResult::Cycle
    } else {
      self.set_map[res_a] = Some(res_b);
      UnionResult::NotCycle
    }
  }
}

type Capacity = u32;
type Cost = i32;

#[derive(Clone, Debug, Default)]
struct Arc {
  start : NodeIndex,
  end : NodeIndex,
  capacity : Capacity,
  cost_per_unit : Cost,

  next : Option<ArcIndex>,
  prev : Option<ArcIndex>,

  on_tree : bool,
}

impl Arc {
  pub fn new(start : NodeIndex, end : NodeIndex, capacity : Capacity, cost_per_unit : Cost) -> Self {
    Self {
      start,
      end,
      capacity,
      cost_per_unit,

      next: None,
      prev: None,

      on_tree: false,
    }
  }

  pub fn as_reverse(&self) -> Self {
    let mut rev = self.clone();
    rev.capacity = 0;
    rev.cost_per_unit *= -1;
    std::mem::swap(&mut rev.start, &mut rev.end);

    rev
  }
}

struct Solution {
  arcs : Vec<Arc>,
  headn : Vec<Option<ArcIndex>>,
  headt : Vec<Option<ArcIndex>>,
  tree : Tree<Cost>,
  total_cost: Cost,
}

impl Solution {

  pub fn new(nodes : usize, arcs : &Vec<Arc>) -> Self {

    let mut this = Self {
      arcs : vec![Arc::default(); 2], // We don't use the first two elements ever.
      headn : vec![None; nodes],
      headt : vec![None; nodes],
      tree : Tree::new(nodes),
      total_cost : 0,
    };

    let mut ufs = UnionFindSet::new(nodes);

    for arc in arcs {
      let arc = arc.clone();

      let on_tree = if let UnionResult::Cycle = ufs.union(arc.start, arc.end) {
        false
      } else {
        true
      };

      let reverse = arc.as_reverse();
      this.add_arc(arc, on_tree);
      this.add_arc(reverse, on_tree);
    }

    this
  }

  fn insert_arc(&mut self, idx : ArcIndex, on_tree : bool) {
    let arc = &mut self.arcs[idx];

    let head = if on_tree {
      &mut self.headt[arc.start]
    } else {
      &mut self.headn[arc.start]
    };

    arc.on_tree = on_tree;

    arc.next = *head;
    arc.prev = None;
    if let Some(i) = *head {
      self.arcs[i].prev = Some(idx);
    }

    *head = Some(idx);
  }

  fn remove_arc(&mut self, idx : usize, on_tree : bool) {
    let arc = &mut self.arcs[idx];
    let head = if on_tree {
      &mut self.headt[arc.start]
    } else {
      &mut self.headn[arc.start]
    };

    let prev = arc.prev;
    let next = arc.next;

    if prev.is_none() {
      *head = next;
    } else {
      self.arcs[prev.unwrap()].next = next;
    }

    if next.is_some() {
      self.arcs[next.unwrap()].prev = prev;
    }
  }

  fn add_arc(&mut self, arc : Arc, on_tree : bool){
    self.arcs.push(arc);
    self.insert_arc(self.arcs.len() - 1, on_tree)
  }

  fn dfs_build_tree(&mut self, o : NodeIndex, pa : Option<NodeIndex> ){
    let mut next = self.headt[o];
    while let Some(i) = next {
      next = self.arcs[i].next;

      {
        let arc = &self.arcs[i];

        if pa.is_some() && arc.end == pa.unwrap() { continue; }

        let odep = self.tree.nodes[o].dep;
        let end = &mut self.tree.nodes[arc.end];
        end.dep = odep + 1;
        end.parent = Some(o);
        end.arc_to_parent = Some(i ^ 1);
        self.tree.costs[arc.end] = self.tree.costs[o] - self.arcs[i].cost_per_unit;
      }

      self.dfs_build_tree(self.arcs[i].end, Some(o));
    }
  }

  fn refresh_tree(&mut self){
    self.tree.clear();
    self.dfs_build_tree(1, None);
  }

  fn find_arc_to_augment(&mut self) -> Option<ArcIndex> {
    self.refresh_tree();

    let mut min_c_pi = 0;
    let mut ret = None;
    for i in 2..self.arcs.len() {
      let arc = &self.arcs[i];

      if !arc.on_tree && arc.capacity > 0 {
        let now_c_pi = arc.cost_per_unit - self.tree.costs[arc.start] + self.tree.costs[arc.end];

        if now_c_pi < min_c_pi {
          min_c_pi = now_c_pi;
          ret = Some(i);
        }
      }
    }

    ret
  }

  fn pivot(&mut self, index : ArcIndex){

    let mut min_capacity = self.arcs[index].capacity;
		let mut argmin_capacity = index;

    let arcs = &mut self.arcs;

    // get min capacity
		self.tree.traverse(arcs[index].end, arcs[index].start, |arc_index| {
      let arc : &Arc = &arcs[arc_index];

			if arc.capacity < min_capacity {
				min_capacity = arc.capacity;
				argmin_capacity = arc_index;
			}
		});

		// let cost_before_augment = self.total_cost;

    // augment
    let mut total_cost = self.total_cost;
		self.tree.traverse(arcs[index].end, arcs[index].start, |arc_index| {
      {
        let arc : &mut Arc = &mut arcs[arc_index];
  			arc.capacity -= min_capacity;

        total_cost += arc.cost_per_unit * min_capacity as i32;
      }
      {
        let sister : &mut Arc = &mut arcs[arc_index ^ 1];
  			sister.capacity += min_capacity;
      }
		});

    self.total_cost = total_cost;

		self.arcs[index].capacity -= min_capacity;
		self.arcs[index ^ 1].capacity += min_capacity;
		self.total_cost += self.arcs[index].cost_per_unit * min_capacity as i32;

		if argmin_capacity != index {
			self.remove_arc(index, false);
			self.remove_arc(index ^ 1, false);
			self.insert_arc(index, true);
			self.insert_arc(index ^ 1, true);

			let remove_tree_arc = argmin_capacity;
			self.remove_arc(remove_tree_arc, true);
			self.remove_arc(remove_tree_arc ^ 1, true);
			self.insert_arc(remove_tree_arc, false);
			self.insert_arc(remove_tree_arc ^ 1, false);
		}
  }

  pub fn solve(&mut self){
    while let Some(arc_to_augment) = self.find_arc_to_augment() {
      self.pivot(arc_to_augment);
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_simplex() {
    let arcs : Vec<[i32; 4]> = vec![
      [0, 1, 1, 0],
      [0, 2, 1, 0],
      [0, 3, 1, 0],
      [0, 4, 1, 0],
      [1, 5, 1, 10],
      [1, 6, 1, 8],
      [2, 5, 1, -6],
      [2, 6, 1, 10],
      [3, 5, 1, 4],
      [3, 6, 1, 8],
      [4, 5, 1, 2],
      [4, 6, 1, 7],
      [5, 7, 2, -100],
      [6, 7, 2, -100]
    ];

    let mut solver = Solution::new(8, &arcs.iter().map(|a| {
      Arc::new(a[0] as usize, a[1] as usize, a[2] as u32, a[3])
    }).collect());

    solver.solve();
    dbg!(solver.total_cost);
  }
}
