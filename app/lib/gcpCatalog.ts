export const GCP_CATEGORIES = [
  "Compute",
  "Storage",
  "Databases",
  "Data & Analytics",
  "Networking",
  "Security",
  "DevOps & Operations",
  "Integration",
  "AI & Machine Learning",
] as const;

export type GcpCategory = (typeof GCP_CATEGORIES)[number];

export type GcpService = {
  id: string;
  name: string;
  category: GcpCategory;
  aliases?: string[];
};

export const GCP_SERVICES: readonly GcpService[] = [
  { id: "compute-engine", name: "Compute Engine", category: "Compute", aliases: ["vm", "virtual machine"] },
  { id: "gke", name: "Google Kubernetes Engine", category: "Compute", aliases: ["gke", "kubernetes", "containers"] },
  { id: "cloud-run", name: "Cloud Run", category: "Compute", aliases: ["serverless", "containers"] },
  { id: "cloud-functions", name: "Cloud Run functions", category: "Compute", aliases: ["cloud functions", "functions", "serverless"] },
  { id: "app-engine", name: "App Engine", category: "Compute", aliases: ["paas", "serverless"] },

  { id: "cloud-storage", name: "Cloud Storage", category: "Storage", aliases: ["gcs", "bucket", "object storage"] },
  { id: "persistent-disk", name: "Persistent Disk", category: "Storage", aliases: ["block storage", "disk"] },
  { id: "filestore", name: "Filestore", category: "Storage", aliases: ["nfs", "file storage"] },

  { id: "cloud-sql", name: "Cloud SQL", category: "Databases", aliases: ["postgres", "mysql", "sql server"] },
  { id: "spanner", name: "Spanner", category: "Databases", aliases: ["cloud spanner", "relational"] },
  { id: "firestore", name: "Firestore", category: "Databases", aliases: ["document database", "nosql"] },
  { id: "bigtable", name: "Bigtable", category: "Databases", aliases: ["cloud bigtable", "nosql"] },
  { id: "memorystore", name: "Memorystore", category: "Databases", aliases: ["redis", "cache"] },

  { id: "bigquery", name: "BigQuery", category: "Data & Analytics", aliases: ["warehouse", "analytics"] },
  { id: "dataflow", name: "Dataflow", category: "Data & Analytics", aliases: ["apache beam", "streaming"] },
  { id: "dataproc", name: "Dataproc", category: "Data & Analytics", aliases: ["spark", "hadoop"] },
  { id: "pubsub", name: "Pub/Sub", category: "Data & Analytics", aliases: ["messaging", "events", "queue"] },

  { id: "vpc", name: "Virtual Private Cloud", category: "Networking", aliases: ["vpc", "network"] },
  { id: "load-balancing", name: "Cloud Load Balancing", category: "Networking", aliases: ["load balancer", "alb"] },
  { id: "cloud-cdn", name: "Cloud CDN", category: "Networking", aliases: ["content delivery"] },
  { id: "cloud-dns", name: "Cloud DNS", category: "Networking", aliases: ["domain", "dns"] },
  { id: "cloud-nat", name: "Cloud NAT", category: "Networking", aliases: ["nat", "egress"] },
  { id: "apigee", name: "Apigee", category: "Networking", aliases: ["api management", "gateway"] },

  { id: "iam", name: "Identity and Access Management", category: "Security", aliases: ["iam", "identity", "permissions"] },
  { id: "secret-manager", name: "Secret Manager", category: "Security", aliases: ["secrets", "credentials"] },
  { id: "cloud-kms", name: "Cloud KMS", category: "Security", aliases: ["keys", "encryption"] },
  { id: "cloud-armor", name: "Cloud Armor", category: "Security", aliases: ["waf", "ddos"] },

  { id: "cloud-build", name: "Cloud Build", category: "DevOps & Operations", aliases: ["ci", "build"] },
  { id: "artifact-registry", name: "Artifact Registry", category: "DevOps & Operations", aliases: ["docker", "packages", "registry"] },
  { id: "cloud-logging", name: "Cloud Logging", category: "DevOps & Operations", aliases: ["logs", "observability"] },
  { id: "cloud-monitoring", name: "Cloud Monitoring", category: "DevOps & Operations", aliases: ["metrics", "observability"] },

  { id: "eventarc", name: "Eventarc", category: "Integration", aliases: ["events", "triggers"] },
  { id: "workflows", name: "Workflows", category: "Integration", aliases: ["orchestration"] },

  { id: "vertex-ai", name: "Vertex AI", category: "AI & Machine Learning", aliases: ["machine learning", "ml", "genai"] },
] as const;

const servicesById = new Map(GCP_SERVICES.map((service) => [service.id, service]));

export function getGcpService(serviceId: string) {
  return servicesById.get(serviceId);
}

export function gcpIconUrl(serviceId: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}gcp-icons/${serviceId}.svg`;
}

export function searchGcpServices(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return GCP_SERVICES;
  return GCP_SERVICES.filter((service) =>
    [service.name, service.category, ...(service.aliases ?? [])]
      .some((value) => value.toLowerCase().includes(normalized)),
  );
}
