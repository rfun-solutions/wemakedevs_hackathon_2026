# API contract

Scope: `api/src/routes/*.ts` and every `web/src` caller of those routes.

AC-1: A PR that changes the path, method, request body or response shape of a route in `api/src/routes/*.ts` updates every web caller of that route (search `web/src` for the path) and its TypeScript types in the same PR, and updates the route's tests. A field is never removed from a response in the same PR that stops sending it to the web.
