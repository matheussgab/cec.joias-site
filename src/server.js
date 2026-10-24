import http from 'node:http';
import { handler } from './app.js';
import { config } from './config.js';

const server = http.createServer(handler);

server.listen(config.port, config.host, () => {
  console.log(`C&C Joias rodando em http://${config.host}:${config.port}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
