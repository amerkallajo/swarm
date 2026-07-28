import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";

import { OVERPASS_ENDPOINT } from "./model.ts";
import type { NetworkPlan, StreamingResponse } from "./runner.ts";

const ALLOWED_HOST = "overpass-api.de";
const ALLOWED_PATH = "/api/interpreter";
const capturedDnsLookup = dnsLookup;
const capturedHttpsRequest = httpsRequest;

function publicIpv4(address: string): boolean {
  const octets = address.split(".").map((part) => Number(part));
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [first = -1, second = -1] = octets;
  return !(
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && octets[2] === 100) ||
    (first === 203 && second === 0 && octets[2] === 113) ||
    first >= 224
  );
}

function publicIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%", 1)[0] ?? "";
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8") ||
    normalized.startsWith("::ffff:")
  ) {
    return false;
  }
  return true;
}

export function isPublicNetworkAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return publicIpv4(address);
  if (family === 6) return publicIpv6(address);
  return false;
}

export function toPlainNetworkBytes(chunk: unknown): Uint8Array | null {
  if (!(chunk instanceof Uint8Array)) return null;
  return new Uint8Array(chunk);
}

const allowlistedLookup: LookupFunction = (hostname, _options, callback) => {
  if (hostname.toLowerCase() !== ALLOWED_HOST) {
    callback(new Error("DNS_HOST_NOT_ALLOWLISTED"), "", 0);
    return;
  }
  capturedDnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error !== null) {
      callback(error, "", 0);
      return;
    }
    if (
      !Array.isArray(addresses) ||
      addresses.length === 0 ||
      addresses.some((item) => !isPublicNetworkAddress(item.address))
    ) {
      callback(new Error("DNS_DESTINATION_NOT_PUBLIC"), "", 0);
      return;
    }
    if (_options.all === true) {
      callback(null, addresses);
      return;
    }
    const selected = addresses[0] as LookupAddress;
    callback(null, selected.address, selected.family);
  });
};

function headerValue(value: string | string[] | undefined, fallback = ""): string {
  if (Array.isArray(value)) return value.join(", ");
  return value ?? fallback;
}

export function createAllowlistedStreamingTransport(): (
  plan: NetworkPlan,
) => Promise<StreamingResponse> {
  return async (plan) => {
    const endpoint = new URL(plan.endpoint);
    if (
      plan.endpoint !== OVERPASS_ENDPOINT ||
      endpoint.protocol !== "https:" ||
      endpoint.hostname.toLowerCase() !== ALLOWED_HOST ||
      endpoint.pathname !== ALLOWED_PATH ||
      endpoint.search !== "" ||
      endpoint.hash !== "" ||
      plan.method !== "POST"
    ) {
      throw new Error("NETWORK_PLAN_NOT_ALLOWLISTED");
    }

    return await new Promise<StreamingResponse>((resolve, reject) => {
      const request = capturedHttpsRequest(
        {
          protocol: "https:",
          hostname: ALLOWED_HOST,
          port: 443,
          path: ALLOWED_PATH,
          method: "POST",
          headers: plan.headers,
          lookup: allowlistedLookup,
          servername: ALLOWED_HOST,
          signal: plan.signal,
        },
        (response) => {
          resolve({
            status: response.statusCode ?? 0,
            url: OVERPASS_ENDPOINT,
            redirected: false,
            headers: {
              "content-type": headerValue(response.headers["content-type"]),
              "content-encoding": headerValue(response.headers["content-encoding"], "identity"),
              ...(response.headers["content-length"] === undefined
                ? {}
                : {
                    "content-length": headerValue(response.headers["content-length"]),
                  }),
            },
            body: {
              async *[Symbol.asyncIterator]() {
                for await (const chunk of response) {
                  const bytes = toPlainNetworkBytes(chunk);
                  if (bytes === null) throw new Error("INVALID_NETWORK_BODY_CHUNK");
                  yield bytes;
                }
              },
            },
            cancel() {
              response.destroy();
            },
          });
        },
      );
      request.once("error", reject);
      request.end(plan.body);
    });
  };
}
