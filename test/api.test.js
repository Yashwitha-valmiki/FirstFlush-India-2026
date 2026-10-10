import test from "node:test";
import assert from "node:assert/strict";
import { server } from "../server.js";

let port;

test.before(async () => {
  await new Promise(resolve => {
    server.listen(0, resolve);
  });

  port = server.address().port;
});

test.after(async () => {
  await new Promise(resolve => {
    server.close(resolve);
  });
});

test("health endpoint returns ok", async () => {
  const response = await fetch(
    `http://127.0.0.1:${port}/api/health`
  );

  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
});

test("state endpoint returns ranked locations", async () => {
  const response = await fetch(
    `http://127.0.0.1:${port}/api/state?dryDays=20&rainfall=40`
  );

  const data = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(data.locations));
  assert.ok(data.locations.length > 0);
});

test("invalid observation is rejected", async () => {
  const response = await fetch(
    `http://127.0.0.1:${port}/api/observations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        locationId: "invalid-location"
      })
    }
  );

  assert.equal(response.status, 400);
});
