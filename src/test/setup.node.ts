import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

// Load .env.test from project root so it's found regardless of Vitest cwd
config({ path: path.join(projectRoot, ".env.test") });
