Shape files are here:

https://www2.census.gov/geo/tiger/TIGER2010BLKPOPHU/

codes here:
https://en.wikipedia.org/wiki/Federal_Information_Processing_Standard_state_code


# Notes

https://arxiv.org/pdf/1710.03358.pdf

This problem of assigning people to districts can be thought of as:

* A Linear Programming problem (in the general case)
* The Generalized Assignment Problem (https://en.wikipedia.org/wiki/Generalized_assignment_problem)
* Minimum Cost Flow problem - Solved with "network simplex algorithm" among other things
  * This library is ported from C++ and so it won't work in WASM https://docs.rs/mcmf/2.0.0/mcmf/struct.GraphBuilder.html

The network simplex algorithm is a specific implementation of the Simplex
Algorithm. **This is by far the fastest it seems**

May be possible to write my own solver for min-cost flow using:

* https://www.topcoder.com/community/competitive-programming/tutorials/minimum-cost-flow-part-two-algorithms/
* https://github.com/orcaman/flownetwork/blob/master/flownetwork.js
* https://docs.rs/petgraph/0.5.0/petgraph/algo/fn.dijkstra.html
* https://crates.io/keywords/graph
* https://www.cs.upc.edu/~erodri/webpage/cps/theory/lp/network/slides.pdf
* NS https://www.ibm.com/developerworks/community/forums/html/topic?id=d7d49692-c2c8-4ff3-8f71-c375bf5ed9bb
* NS trees? https://ocw.mit.edu/courses/sloan-school-of-management/15-082j-network-optimization-fall-2010/lecture-notes/MIT15_082JF10_lec16.pdf
* https://github.com/splintersu/NetworkSimplex/blob/master/network_simplex_solver.cpp

# References

* How simplex algorithm works http://fourier.eng.hmc.edu/e176/lectures/NM/node32.html
* How to use Network Simplex for min-cost flow problems https://www3.diism.unisi.it/~agnetis/simpretENG.pdf

## Rust Linear Programming solvers

-[ ] https://crates.io/crates/rulp
-[ ] https://crates.io/crates/linprog


# Completely different method of solving

* Shortest splitline method
  * https://rangevoting.org/TheorDistrict.html
  * https://rangevoting.org/Splitlining.html
* Minimum Variance splitline
  * https://www.rangevoting.org/MinVarSplitline.txt
* Otsu threshold finding
  * https://en.wikipedia.org/wiki/Otsu%27s_method
  * http://www.labbookpages.co.uk/software/imgProc/otsuThreshold.html
* Jenks Natural Breaks http://bl.ocks.org/tmcw/4969184
