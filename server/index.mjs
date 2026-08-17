import { createApp } from "./app.mjs";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "127.0.0.1";
const logLevel = process.env.LOG_LEVEL ?? "info";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

const app = await createApp({
  logger: { level: logLevel },
});

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.fatal({ err: error, host, port }, "server failed to start");
  process.exitCode = 1;
}
