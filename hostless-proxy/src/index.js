import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));
const epoxyPath = path.resolve(process.cwd(), "node_modules/@mercuryworkshop/epoxy-transport/dist");

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
  allow_udp_streams: false,
  dns_servers: ["1.1.1.1", "1.0.0.1"]
});

const fastify = Fastify({
  logger: true,
  serverFactory: (handler) => createServer()
    .on("request", (req, res) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      res.setHeader("X-Content-Type-Options", "nosniff");
      handler(req, res);
    })
    .on("upgrade", (req, socket, head) => {
      if (req.url && req.url.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
      else socket.end();
    })
});

fastify.get("/healthz", async () => ({
  ok: true,
  service: "figure-cloud-scramjet-epoxy",
  transport: "epoxy",
  autoLoad: true
}));

fastify.register(fastifyStatic, { root: publicPath, decorateReply: true, index: ["index.html"] });
fastify.register(fastifyStatic, { root: scramjetPath, prefix: "/scram/", decorateReply: false });
fastify.register(fastifyStatic, { root: baremuxPath, prefix: "/baremux/", decorateReply: false });
fastify.register(fastifyStatic, { root: epoxyPath, prefix: "/epoxy/", decorateReply: false });

fastify.setNotFoundHandler((req, reply) => reply.code(404).type("text/plain").send("Not found"));

const port = Number(process.env.PORT || 8080);
fastify.listen({ port, host: "0.0.0.0" }).catch((error) => {
  fastify.log.error(error);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await fastify.close();
    process.exit(0);
  });
}
