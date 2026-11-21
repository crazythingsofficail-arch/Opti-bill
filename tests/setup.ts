import path from "node:path";
import fs from "node:fs";

const testDataDir = path.resolve(__dirname, "temp_data");
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

const testUploadsDir = path.join(testDataDir, "uploads");
if (!fs.existsSync(testUploadsDir)) {
  fs.mkdirSync(testUploadsDir, { recursive: true });
}

process.env.OPTI_DATA_DIR = testDataDir;
process.env.OPTI_STORE_PATH = path.join(testDataDir, "store.json");
process.env.OPTI_BACKUP_PATH = path.join(testDataDir, "store.json.bak");
process.env.OPTI_UPLOADS_DIR = testUploadsDir;
