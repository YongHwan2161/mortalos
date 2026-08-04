import { decodeBase64Url } from "../../src/bytes.mjs";
import { parseJsonBytes } from "../../src/codec.mjs";
import {
  describeCustodyProvider,
  registerCustodyProviderCapability
} from "../../src/provider/possession.mjs";

const fetchIntrinsic = globalThis.fetch;
const responseArrayBuffer = Response.prototype.arrayBuffer;

function boundedUrl(value) {
  if (typeof value !== "string" || !/^https?:\/\//u.test(value) || value.length > 2048) {
    throw new TypeError("bounded HTTP provider URL required");
  }
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("HTTP provider URL must not contain credentials or state");
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

async function bodyBytes(response) {
  return new Uint8Array(await Reflect.apply(responseArrayBuffer, response, []));
}

export class HttpPossessionProvider {
  constructor({ baseUrl, bearerToken, identity }) {
    const endpoint = boundedUrl(baseUrl);
    if (typeof bearerToken !== "string" || bearerToken.length < 16 || bearerToken.length > 256) {
      throw new TypeError("bounded HTTP provider bearer token required");
    }
    const authorization = `Bearer ${bearerToken}`;
    const call = async (path, init) => {
      const response = await fetchIntrinsic(new URL(path, endpoint), {
        ...init,
        headers: {
          authorization,
          ...(init?.headers ?? {})
        },
        signal: AbortSignal.timeout(7_500)
      });
      if (!response.ok) throw new Error(`possession-provider-http-${response.status}`);
      return response;
    };
    registerCustodyProviderCapability(this, {
      read: async (digest) => bodyBytes(await call(
        `objects?digest=${encodeURIComponent(digest)}`,
        { method: "GET" }
      )),
      identity,
      store: async (copyBytes) => {
        const response = await call("objects", {
          body: copyBytes,
          headers: { "content-type": "application/octet-stream" },
          method: "POST"
        });
        const body = parseJsonBytes(await bodyBytes(response), { maxBytes: 65_536, maxDepth: 8 });
        if (
          Object.keys(body).sort().join(",") !== "format,receipt_base64url" ||
          body.format !== "mortalos-provider-store-response/1"
        ) {
          throw new Error("possession-provider-response-invalid");
        }
        const receipt = decodeBase64Url(body.receipt_base64url);
        if (!receipt) throw new Error("possession-provider-receipt-invalid");
        return receipt;
      }
    });
    Object.freeze(this);
  }

  describe() {
    return describeCustodyProvider(this);
  }
}
