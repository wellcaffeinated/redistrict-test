use std::convert::Infallible;
use std::net::SocketAddr;
use hyper::{Body, Request, Response, Server, Method, StatusCode};
use hyper::service::{make_service_fn, service_fn};

async fn hello_world(req: Request<Body>) -> Result<Response<Body>, Infallible> {
  let mut response = Response::new(Body::empty());

  match (req.method(), req.uri().path()) {
    (&Method::GET, "/") => {
      *response.body_mut() = Body::from("Try POSTing data to /echo");
    },
    (&Method::GET, "/echo") => {
      *response.body_mut() = Body::from(req.uri().query().map(|c| c.to_string()).unwrap_or_default());
    },
    _ => {
      *response.status_mut() = StatusCode::NOT_FOUND;
      *response.body_mut() = Body::from("<p>Not Found</p>");
    },
  };

  Ok(response)
}

#[tokio::main]
async fn main() {
  // We'll bind to 127.0.0.1:3000
  let addr = SocketAddr::from(([127, 0, 0, 1], 3000));

  // A `Service` is needed for every connection, so this
  // creates one from our `hello_world` function.
  let make_svc = make_service_fn(|_conn| async {
    // service_fn converts our function into a `Service`
    Ok::<_, Infallible>(service_fn(hello_world))
  });

  let server = Server::bind(&addr).serve(make_svc);

  // Run this server for... forever!
  if let Err(e) = server.await {
    eprintln!("server error: {}", e);
  }
}
