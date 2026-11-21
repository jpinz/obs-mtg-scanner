import { describe, expect, it } from "vitest";
import { filterCatalog } from "./collectorvision-catalog-filter.mjs";

const catalog = {
  embeddings: new Uint16Array([10, 11, 20, 21, 30, 31, 40, 41]),
  cardIds: ["other-card", "woe-card", "mom-card", "woe-card"],
  cardNames: ["Other card", "WOE front", "MOM card", "WOE back"],
  secondaryIds: ["other-oracle", "woe-oracle", "mom-oracle", "woe-oracle"],
  dims: 2,
  rows: 4,
};

describe("filterCatalog", () => {
  it("keeps only allowed print IDs, including all faces, with aligned embeddings and metadata", () => {
    const filtered = filterCatalog(catalog, ["woe-card", "mom-card"]);
    expect(filtered.cardIds).toEqual(["woe-card", "mom-card", "woe-card"]);
    expect(filtered.embeddings).toEqual(new Uint16Array([20, 21, 30, 31, 40, 41]));
    expect(filtered.cardNames).toEqual(["WOE front", "MOM card", "WOE back"]);
    expect(filtered.secondaryIds).toEqual(["woe-oracle", "mom-oracle", "woe-oracle"]);
    expect(filtered.rows).toBe(3);
  });

  it("handles missing names and secondary IDs and respects the loaded row count", () => {
    const filtered = filterCatalog({ ...catalog, cardNames: null, secondaryIds: null, rows: 3 }, ["woe-card"]);
    expect(filtered.cardIds).toEqual(["woe-card"]);
    expect(filtered.embeddings).toEqual(new Uint16Array([20, 21]));
    expect(filtered.cardNames).toBeNull();
    expect(filtered.secondaryIds).toBeNull();
  });

  it("fails explicitly when no requested cards are in the catalog", () => {
    expect(() => filterCatalog(catalog, ["missing-card"])).toThrow("No cards from the requested sets");
    expect(() => filterCatalog(catalog, [])).toThrow("No cards from the requested sets");
  });
});
