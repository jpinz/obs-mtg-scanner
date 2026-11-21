import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  setLayoutBox,
  parseSettings,
  serializeOverlaySettings,
  serializeSettings,
  type OverlaySettings,
} from "./settings";

describe("parseSettings", () => {
  it("returns defaults for an empty query", () => {
    expect(parseSettings("")).toEqual(DEFAULT_SETTINGS);
  });

  it("parses every supported parameter", () => {
    const s = parseSettings(
      "?currency=eur_foil&finishes=1&image=0&name=0&info=off&details=price,set,confidence&ipos=0.1,0.2,0.3,0.4&npos=0.3,0.4,0.2,0.05&dpos=0.5,0.6,0.25,0.3"
        + "&ts=20&nts=32&dts=14&dsz=price:28,SET:12,bogus:9,rarity:abc&fts=18"
        + "&follow=1&sides=right,left&duration=0&threshold=0.7&setcode=woe&query=t%3Acreature&camera=abc&res=1920x1080&mirror=1&theme=light&accent=22c55e&debug=on",
    );
    expect(s).toEqual<OverlaySettings>({
      currency: "eur_foil",
      allFinishes: true,
      showImage: false,
      showName: false,
      showDetails: false,
      showTotal: true,
      details: ["set", "price", "confidence"],
      layout: {
        image: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
        name: { x: 0.3, y: 0.4, width: 0.2, height: 0.05 },
        details: { x: 0.5, y: 0.6, width: 0.25, height: 0.3 },
        total: DEFAULT_SETTINGS.layout.total,
      },
      textSize: 20,
      nameTextSize: 32,
      detailsTextSize: 14,
      detailTextSizes: { set: 12, price: 28 },
      followTextSize: 18,
      follow: true,
      followSides: ["left", "right"],
      duration: 0,
      threshold: 0.7,
      setCodes: ["woe"],
      query: "t:creature",
      camera: "abc",
      resolution: { width: 1920, height: 1080 },
      mirror: true,
      ignoreZones: [],
      theme: "light",
      accent: "#22c55e",
      debug: true,
    });
  });

  it("ignores legacy catalog selections while preserving other settings", () => {
    const settings = parseSettings("?catalog=v1&setcode=woe");
    expect(settings).toEqual({ ...DEFAULT_SETTINGS, setCodes: ["woe"] });
    expect(serializeSettings(settings).has("catalog")).toBe(false);
  });

  it("combines comma-separated and repeated set codes, ignoring case, whitespace, and duplicates", () => {
    expect(parseSettings("?setcode=%20WOE%20,mom,,&setcode=MOM,dmu").setCodes).toEqual(["woe", "mom", "dmu"]);
    expect(parseSettings("?setcode=%20,,").setCodes).toEqual([]);
  });

  it("orders list params, dropping duplicates and unknown values, with none or empty meaning no items", () => {
    expect(parseSettings("?details=price,PRICE,foo,%20set").details).toEqual(["set", "price"]);
    expect(parseSettings("?sides=right,top,top,diagonal").followSides).toEqual(["top", "right"]);
    expect(parseSettings("?details=none&sides=").details).toEqual([]);
    expect(parseSettings("?details=none&sides=").followSides).toEqual([]);
  });

  it("falls back per layout item on invalid boxes and clamps boxes inside the canvas", () => {
    expect(parseSettings("?ipos=abc&npos=0.5,0.5,0.1&dpos=0.9,-1,0.5,0").layout).toEqual({
      image: DEFAULT_SETTINGS.layout.image,
      name: DEFAULT_SETTINGS.layout.name,
      details: { x: 0.5, y: 0, width: 0.5, height: 0.02 },
      total: DEFAULT_SETTINGS.layout.total,
    });
  });

  it("reads legacy x,y positions with the default size", () => {
    expect(parseSettings("?npos=0.1,0.2").layout.name).toEqual({ ...DEFAULT_SETTINGS.layout.name, x: 0.1, y: 0.2 });
  });

  it("round-trips the total overlay visibility and layout", () => {
    const settings = { ...DEFAULT_SETTINGS, showTotal: false, layout: setLayoutBox(DEFAULT_SETTINGS.layout, "total", { x: 0.3 }) };
    const query = serializeOverlaySettings(settings);
    expect(query.get("total")).toBe("0");
    expect(query.get("tpos")).toBe("0.3,0.05,0.18,0.09");
    expect(parseSettings(query)).toEqual(settings);
  });

  it("translates legacy scale and image width params", () => {
    const s = parseSettings("?scale=1.5&iw=488&ipos=0.1,0.2");
    expect(s.textSize).toBe(24);
    expect(s.layout.image).toEqual({ x: 0.1, y: 0.2, width: 0.2542, height: 0.6296 });
    expect(parseSettings("?scale=1.5&ts=12").textSize).toBe(12);
    const query = serializeSettings(s);
    expect(query.has("scale")).toBe(false);
    expect(query.has("iw")).toBe(false);
    expect(parseSettings(query)).toEqual(s);
  });

  it("decodes and trims Scryfall queries without changing their syntax", () => {
    expect(parseSettings("?query=%20name%3A%22Fire%20%26%20Ice%22%20OR%20pow%3E%3D3%20").query)
      .toBe('name:"Fire & Ice" OR pow>=3');
    expect(parseSettings("?query=%20%20").query).toBe("");
  });

  it("round-trips valid ignore polygons and rejects malformed or degenerate ones", () => {
    const zones = [[[0.1, 0.2], [0.8, 0.2], [0.5, 0.9]]] as const;
    const query = serializeSettings({ ...DEFAULT_SETTINGS, ignoreZones: zones });
    expect(parseSettings(query).ignoreZones).toEqual(zones);
    expect(serializeOverlaySettings({ ...DEFAULT_SETTINGS, ignoreZones: zones }).has("ignore")).toBe(false);
    query.set("ignore", JSON.stringify([...zones, [[0, 0], [1, 1], [0.5, 0.5]], [[-1, 0], [1, 0], [0, 1]]]));
    expect(parseSettings(query).ignoreZones).toEqual(zones);
    query.set("ignore", "{");
    expect(parseSettings(query).ignoreZones).toEqual([]);
  });

  it("falls back or clamps on invalid values", () => {
    const s = parseSettings("?currency=gbp&image=maybe&threshold=5&ts=500&nts=abc&fts=2&res=big&accent=red&duration=-3");
    expect(s.currency).toBe(DEFAULT_SETTINGS.currency);
    expect(s.showImage).toBe(DEFAULT_SETTINGS.showImage);
    expect(s.threshold).toBe(1);
    expect(s.textSize).toBe(96);
    expect(s.nameTextSize).toBeNull();
    expect(s.followTextSize).toBe(8);
    expect(s.resolution).toEqual(DEFAULT_SETTINGS.resolution);
    expect(s.accent).toBe(DEFAULT_SETTINGS.accent);
    expect(s.duration).toBe(0);
  });
});

describe("serializeSettings", () => {
  it("omits defaults and round-trips changed values", () => {
    expect(serializeSettings({ ...DEFAULT_SETTINGS }).toString()).toBe("");
    const changed: OverlaySettings = {
      ...DEFAULT_SETTINGS,
      currency: "tix",
      allFinishes: true,
      setCodes: ["woe", "mom"],
      query: 't:creature OR name:"Fire & Ice"',
      mirror: true,
      resolution: { width: 1920, height: 1080 },
      camera: "device id/with+chars",
      showName: false,
      details: [],
      layout: setLayoutBox(DEFAULT_SETTINGS.layout, "details", { x: 0.25, y: 0.75, width: 0.3 }),
      textSize: 18,
      nameTextSize: 30,
      detailTextSizes: { price: 24 },
      follow: true,
      followSides: [],
    };
    const query = serializeSettings(changed);
    expect(query.get("setcode")).toBe("woe,mom");
    expect(query.get("finishes")).toBe("1");
    expect(query.get("details")).toBe("none");
    expect(query.get("sides")).toBe("none");
    expect(query.get("dpos")).toBe("0.25,0.75,0.3,0.2");
    expect(query.get("dsz")).toBe("price:24");
    expect(query.has("dts")).toBe(false);
    expect(query.has("ipos")).toBe(false);
    expect(query.has("theme")).toBe(false);
    expect(parseSettings(query.toString())).toEqual(changed);
  });

  it("rounds layout boxes to 4 decimals", () => {
    const layout = setLayoutBox(DEFAULT_SETTINGS.layout, "image", { x: 0.123456, y: 0.5, width: 0.111111, height: 0.2 });
    expect(serializeSettings({ ...DEFAULT_SETTINGS, layout }).get("ipos")).toBe("0.1235,0.5,0.1111,0.2");
  });

  it("keeps only overlay params, including layout, for the overlay page", () => {
    const query = serializeOverlaySettings({
      ...DEFAULT_SETTINGS,
      camera: "abc",
      setCodes: ["woe"],
      follow: true,
      allFinishes: true,
      layout: setLayoutBox(DEFAULT_SETTINGS.layout, "name", { x: 0.1, y: 0.1 }),
      followTextSize: 20,
    });
    expect(query.toString()).toBe("finishes=1&npos=0.1%2C0.1%2C0.18%2C0.05&fts=20&follow=1");
  });
});

describe("setLayoutBox", () => {
  it("updates one item, keeping it inside the canvas, without changing the original", () => {
    const moved = setLayoutBox(DEFAULT_SETTINGS.layout, "name", { x: -0.2, y: 1.5, width: Number.NaN });
    expect(moved).toEqual({ ...DEFAULT_SETTINGS.layout, name: { x: 0, y: 0.95, width: 0.18, height: 0.05 } });
    expect(DEFAULT_SETTINGS.layout.name).toEqual({ x: 0.8, y: 0.47, width: 0.18, height: 0.05 });
  });
});
