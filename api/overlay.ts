import process from "node:process";
import { handleOverlayRequest, overlayStoreFromEnv } from "../server/overlayRelay.js";

const store = overlayStoreFromEnv(process.env);

async function handle(request: Request): Promise<Response> {
  if (!store) {
    console.error("Overlay storage is not configured. Connect an Upstash Redis database to the project.");
    return Response.json({ error: "Overlay storage is not configured" }, { status: 503 });
  }
  return handleOverlayRequest(request, store);
}

export { handle as GET, handle as POST };
