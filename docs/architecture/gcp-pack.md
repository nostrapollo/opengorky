# Google Cloud architecture pack

The canvas includes a curated Google Cloud service palette for architecture planning. Open it from the cloud button in the main tool dock, search by product name, category, or a common alias, then click a service to place it at the viewport center or drag it to a precise canvas position.

Each service is a native `gcp-service` canvas object. It can be selected, moved, resized, rotated, connected, reordered, duplicated, renamed, saved locally, and round-tripped through JSON import/export using its stable `gcpServiceId`. The renderer resolves the matching checked-in SVG, so saved files stay compact and the app remains fully static with no runtime dependency on Google services.

## Included categories

- Compute
- Storage
- Databases
- Data and analytics
- Networking
- Security
- DevOps and operations
- Integration
- AI and machine learning

The catalog is deliberately curated rather than mirroring every Google Cloud SKU. Additions require a stable service ID, category, search aliases, an SVG in `public/gcp-icons`, and catalog/model/import-export test coverage.

## Artwork provenance

Artwork comes from Google's official [Cloud icon library](https://cloud.google.com/icons). Current core-product artwork is preferred; the official legacy product archive supplies services without a current core icon. Google Cloud names and artwork are trademarks or brand assets of Google LLC and are not covered by opengorky's MIT license. See [third-party licenses](../third-party-licenses.md).
