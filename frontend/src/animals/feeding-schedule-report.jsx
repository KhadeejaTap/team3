import { useEffect, useMemo, useState } from "react";

const styles = {
  page: {
    minHeight: "100vh",
    padding: "30px 18px",
    background: "#f4f7f2",
    color: "#203126",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  shell: { maxWidth: 1100, margin: "0 auto" },
  header: { marginBottom: 24 },
  eyebrow: {
    margin: 0,
    color: "#54735c",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  title: { margin: "8px 0", fontSize: "clamp(28px, 5vw, 40px)" },
  intro: { margin: 0, maxWidth: 720, lineHeight: 1.6, color: "#5d6c60" },
  toolbar: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    margin: "22px 0 16px",
  },
  input: {
    flex: "1 1 240px",
    minWidth: 0,
    padding: "11px 13px",
    border: "1px solid #ccd7cd",
    borderRadius: 11,
    fontSize: 15,
    background: "#fff",
  },
  select: {
    padding: "11px 13px",
    border: "1px solid #ccd7cd",
    borderRadius: 11,
    fontSize: 15,
    background: "#fff",
  },
  button: {
    padding: "11px 15px",
    border: 0,
    borderRadius: 11,
    background: "#315d3b",
    color: "#fff",
    fontSize: 14,
    fontWeight: 750,
    cursor: "pointer",
  },
  panel: {
    background: "#fff",
    border: "1px solid #dce5dc",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 8px 24px rgba(32,49,38,0.05)",
  },
  summary: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    padding: 16,
    borderBottom: "1px solid #e5ece5",
  },
  metric: {
    padding: "12px 15px",
    borderRadius: 12,
    background: "#f3f7f1",
    minWidth: 145,
  },
  metricLabel: { margin: 0, color: "#647567", fontSize: 12 },
  metricValue: { margin: "4px 0 0", fontSize: 22, fontWeight: 800 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
  th: {
    padding: "13px 15px",
    background: "#f8faf7",
    color: "#506253",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 15px",
    borderTop: "1px solid #edf1ec",
    fontSize: 14,
    verticalAlign: "top",
  },
  muted: { color: "#647567" },
  status: {
    padding: 18,
    background: "#fff",
    border: "1px solid #dce5dc",
    borderRadius: 14,
    color: "#5d6c60",
    lineHeight: 1.6,
  },
};

function formatTime(value) {
  if (!value) return "Not listed";
  const [hourString, minuteString] = String(value).split(":");
  const hour = Number(hourString);
  if (!Number.isFinite(hour) || minuteString === undefined) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteString.slice(0, 2)} ${suffix}`;
}

function formatAmount(value) {
  if (value === null || value === undefined || value === "") return "Not listed";
  // FEEDING.amount has no unit column in the current schema.
  return `${value} (unit not specified)`;
}

function downloadCsv(rows) {
  const columns = [
    ["Feeding time", (row) => formatTime(row.feeding_time)],
    ["Animal", (row) => row.animal_name || ""],
    ["Species", (row) => row.species_name || ""],
    ["Food", (row) => row.food_name || ""],
    ["Amount", (row) => row.amount ?? ""],
    ["Enclosure", (row) => row.enclosure_name || ""],
  ];
  const escapeCsv = (value) => {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  };
  const lines = [
    columns.map(([heading]) => escapeCsv(heading)).join(","),
    ...rows.map((row) => columns.map(([, getValue]) => escapeCsv(getValue(row))).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "animal-feeding-schedule.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function FeedingScheduleReport() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/reports/feeding-schedule");

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error("The report endpoint must return a JSON array.");
        }

        if (!cancelled) {
          setRecords(
            data.slice().sort((a, b) =>
              String(a.feeding_time || "").localeCompare(String(b.feeding_time || ""))
            )
          );
        }
      } catch {
        if (!cancelled) {
          setError(
            "The feeding report could not be loaded. Check that your backend provides GET /api/reports/feeding-schedule and returns expected JSON fields."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReport();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return records.filter((row) => {
      const matchesSearch =
        !term ||
        [row.animal_name, row.species_name, row.food_name, row.enclosure_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      const hour = Number(String(row.feeding_time || "").split(":")[0]);
      const matchesTime =
        timeFilter === "all" ||
        (timeFilter === "morning" && hour >= 5 && hour < 12) ||
        (timeFilter === "afternoon" && hour >= 12 && hour < 17) ||
        (timeFilter === "evening" && (hour >= 17 || hour < 5));

      return matchesSearch && matchesTime;
    });
  }, [records, search, timeFilter]);

  const uniqueAnimals = new Set(filtered.map((row) => row.animal_ID ?? row.animal_name)).size;
  const uniqueFoods = new Set(filtered.map((row) => row.food_name).filter(Boolean)).size;

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <p style={styles.eyebrow}>Visitor information</p>
          <h1 style={styles.title}>Animal Feeding Schedule</h1>
          <p style={styles.intro}>
            See when the zoo's animals are scheduled to eat, what food is listed,
            and which habitat they call home. Feeding times are shown in local zoo time.
          </p>
        </header>

        <section style={styles.toolbar} aria-label="Filter feeding report">
          <input
            style={styles.input}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search animal, species, food, or habitat…"
            aria-label="Search feeding schedule"
          />
          <select
            style={styles.select}
            value={timeFilter}
            onChange={(event) => setTimeFilter(event.target.value)}
            aria-label="Filter by time of day"
          >
            <option value="all">All times</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening / overnight</option>
          </select>
          <button
            type="button"
            style={styles.button}
            onClick={() => downloadCsv(filtered)}
            disabled={filtered.length === 0}
            title={filtered.length === 0 ? "No rows to export" : "Download filtered report as CSV"}
          >
            Export CSV
          </button>
        </section>

        {loading && <div style={styles.status}>Loading feeding schedule…</div>}
        {!loading && error && <div role="alert" style={styles.status}>{error}</div>}
        {!loading && !error && (
          <>
            <section style={styles.panel} aria-label="Feeding schedule report">
              <div style={styles.summary}>
                <div style={styles.metric}>
                  <p style={styles.metricLabel}>Feeding entries</p>
                  <p style={styles.metricValue}>{filtered.length}</p>
                </div>
                <div style={styles.metric}>
                  <p style={styles.metricLabel}>Animals included</p>
                  <p style={styles.metricValue}>{uniqueAnimals}</p>
                </div>
                <div style={styles.metric}>
                  <p style={styles.metricLabel}>Food types listed</p>
                  <p style={styles.metricValue}>{uniqueFoods}</p>
                </div>
              </div>

              {filtered.length === 0 ? (
                <p style={{ padding: 18, margin: 0, ...styles.muted }}>
                  No feeding records match these filters.
                </p>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Time</th>
                        <th style={styles.th}>Animal</th>
                        <th style={styles.th}>Species</th>
                        <th style={styles.th}>Food</th>
                        <th style={styles.th}>Amount</th>
                        <th style={styles.th}>Habitat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row, index) => (
                        <tr key={`${row.animal_ID ?? row.animal_name}-${row.food_name}-${row.feeding_time}-${index}`}>
                          <td style={{ ...styles.td, whiteSpace: "nowrap", fontWeight: 750 }}>
                            {formatTime(row.feeding_time)}
                          </td>
                          <td style={styles.td}>{row.animal_name || "Not listed"}</td>
                          <td style={styles.td}>{row.species_name || "Not listed"}</td>
                          <td style={styles.td}>{row.food_name || "Not listed"}</td>
                          <td style={styles.td}>{formatAmount(row.amount)}</td>
                          <td style={styles.td}>{row.enclosure_name || "Not listed"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <p style={{ marginTop: 14, fontSize: 12, color: "#718074", lineHeight: 1.5 }}>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
