import app from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";

async function startServer() {
  try {
    await connectDb(env.mongoUri);
    app.listen(env.port, () => {
      console.log(`PMS API listening on port ${env.port}`);
    });

    // Start sensor gateway services (non-blocking, graceful if deps are missing)
    try {
      const { alarmEngine } = await import("./services/alarmEngine.js");
      alarmEngine.start().catch(e => console.error('[Alarm] Start failed:', e.message));
    } catch (e) { console.warn('[Alarm] Module not available:', e.message); }

    try {
      const { opcuaGateway } = await import("./services/opcuaGateway.js");
      opcuaGateway.start().catch(e => console.error('[OPC-UA] Start failed:', e.message));
    } catch (e) { console.warn('[OPC-UA] Module not available:', e.message); }

    try {
      const { modbusPoller } = await import("./services/modbusPoller.js");
      modbusPoller.start().catch(e => console.error('[Modbus] Start failed:', e.message));
    } catch (e) { console.warn('[Modbus] Module not available:', e.message); }
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();
