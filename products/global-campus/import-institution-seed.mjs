#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { parseCsv, convertInstitutionRows } from "./seed-import.mjs";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error("Usage: node import-institution-seed.mjs <input.csv> <output.json>");
  process.exitCode = 2;
} else {
  const csv = await readFile(inputPath, "utf8");
  const rows = parseCsv(csv);
  const records = convertInstitutionRows(rows);
  await writeFile(outputPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    record_count: records.length,
    records
  }, null, 2) + "\n");
  console.log(`Staged ${records.length} institution records for verification; none were published as verified.`);
}
