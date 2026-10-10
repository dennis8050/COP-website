import { execute, Request } from "./api.js";
import { ApiError } from "./errors.js";
import { ZodError } from "zod";
export async function respond(r: Request, requestId = "local") {
  const started = Date.now();
  try {
    const out = await execute(r);
    console.info(
      JSON.stringify({
        requestId,
        method: r.method,
        path: r.path,
        status: out.status,
        durationMs: Date.now() - started,
      }),
    );
    return {
      statusCode: out.status,
      body: JSON.stringify({ success: true, data: out.data }),
    };
  } catch (e) {
    let status = 500,
      code = "INTERNAL_ERROR",
      message = "An unexpected error occurred";
    if (e instanceof ApiError) {
      status = e.status;
      code = e.code;
      message = e.message;
    } else if (e instanceof ZodError) {
      status = 400;
      code = "VALIDATION_ERROR";
      message = e.issues
        .map((x) => x.path.join(".") + ": " + x.message)
        .join("; ");
    } else if ((e as { code?: string }).code === "23505") {
      status = 409;
      const attendanceDuplicate =
        (e as { constraint?: string }).constraint ===
        "attendance_member_id_service_id_key";
      code = attendanceDuplicate ? "ALREADY_CHECKED_IN" : "CONFLICT";
      message = attendanceDuplicate
        ? "Already Checked In"
        : "This record already exists";
    } else if ((e as { code?: string }).code === "23503") {
      status = 409;
      code = "REFERENCE_CONFLICT";
      message = "A related record is missing or still in use";
    }
    console.error(
      JSON.stringify({ requestId, status, code, errorType: (e as Error).name }),
    );
    return {
      statusCode: status,
      body: JSON.stringify({ success: false, error: { code, message } }),
    };
  }
}
export async function handler(event: {
  httpMethod: string;
  path: string;
  headers: Record<string, string>;
  queryStringParameters: Record<string, string> | null;
  body: string | null;
  requestContext: { requestId: string };
}) {
  let body: unknown = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: { code: "INVALID_JSON", message: "Invalid JSON body" },
      }),
    };
  }
  const result = await respond(
    {
      method: event.httpMethod,
      path: event.path,
      headers: Object.fromEntries(
        Object.entries(event.headers || {}).map(([k, v]) => [
          k.toLowerCase(),
          v,
        ]),
      ),
      query: event.queryStringParameters || {},
      body,
    },
    event.requestContext.requestId,
  );
  return {
    ...result,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "",
      "X-Content-Type-Options": "nosniff",
    },
  };
}
