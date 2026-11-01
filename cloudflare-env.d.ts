declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    RESULTS_OWNER_EMAIL?: string;
  }
}
