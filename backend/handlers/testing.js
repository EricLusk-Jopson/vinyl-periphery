// Minimal stand-ins for the request and response objects that Express and
// Vercel's Node.js runtime both provide. Used by the handler tests only.

export function mockRequest({ method = "GET", query = {}, body, headers = {} } = {}) {
  return { method, query, body, headers };
}

export function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = String(value);
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}
