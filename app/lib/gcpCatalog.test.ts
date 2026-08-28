import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GCP_CATEGORIES, GCP_SERVICES, getGcpService, searchGcpServices } from "./gcpCatalog";

describe("Google Cloud architecture catalog", () => {
  it("has unique service IDs and a checked-in icon for every service", () => {
    expect(new Set(GCP_SERVICES.map((service) => service.id)).size).toBe(GCP_SERVICES.length);
    for (const service of GCP_SERVICES) {
      expect(GCP_CATEGORIES).toContain(service.category);
      expect(existsSync(resolve(process.cwd(), "public", "gcp-icons", `${service.id}.svg`))).toBe(true);
    }
  });

  it("supports service names, aliases, and categories in search", () => {
    expect(searchGcpServices("redis").map((service) => service.id)).toContain("memorystore");
    expect(searchGcpServices("networking").map((service) => service.id)).toContain("vpc");
    expect(searchGcpServices("cloud run").map((service) => service.id)).toEqual(
      expect.arrayContaining(["cloud-run", "cloud-functions"]),
    );
    expect(getGcpService("bigquery")?.name).toBe("BigQuery");
  });
});
