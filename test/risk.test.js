import test from "node:test";
import assert from "node:assert/strict";
import { calculateRisk } from "../server.js";

const location = {
  distance: 200,
  paved: 80,
  traffic: 80,
  construction: 70,
  waste: 60,
  blockage: 50
};

test("heavy rain after a long dry period produces higher risk", () => {
  const lowRisk = calculateRisk(location, {
    dryDays: 2,
    rainfall: 2,
    intensity: 5
  });

  const highRisk = calculateRisk(location, {
    dryDays: 20,
    rainfall: 40,
    intensity: 90
  });

  assert.ok(highRisk.score > lowRisk.score);
});
