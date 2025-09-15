import { buildTravelRows } from "../lib/computeTravel";

test("buildTravelRows requires known venues and teams", () => {
  expect(() => buildTravelRows([], {}, {}, 1)).not.toThrow();
});

