export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  if (field.length || row.length) {
    row.push(field);
    if (row.some(value => value.length > 0)) rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map(value => value.trim());
  return rows.slice(1).map(values => Object.fromEntries(
    headers.map((header, index) => [header, (values[index] ?? "").trim()])
  ));
}

export function convertInstitutionRows(rows) {
  return rows.map(row => ({
    id: row.record_id,
    name: row.institution_name,
    country_id: "ZA",
    institution_type: mapInstitutionType(row.institution_type),
    region: row.province || null,
    registration_status: "unknown",
    source: {
      title: row.source_name || "Seed source",
      url: row.source_url || null
    },
    verification: {
      status: "needs-review",
      note: row.notes || null
    },
    import_status: "staged-not-published"
  }));
}

function mapInstitutionType(value = "") {
  const normalized = value.toLowerCase();
  if (normalized.includes("university of technology")) return "university-of-technology";
  if (normalized.includes("private higher education")) return "private-higher-education";
  if (normalized.includes("university")) return "public-university";
  if (normalized.includes("tvet")) return "public-tvet";
  if (normalized.includes("cet")) return "public-cet";
  if (normalized.includes("private")) return "private-college";
  return "other-tertiary";
}
