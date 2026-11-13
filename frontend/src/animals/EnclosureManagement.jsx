import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';

const EMPTY_MAINTENANCE = {
  maintenance_date: new Date().toISOString().slice(0, 10),
  maintenance_type: '',
  description: '',
  status: 'Scheduled',
  notes: ''
};

const CONDITION_OPTIONS = ['Good', 'Fair', 'Poor', 'Under Maintenance'];
const MAINTENANCE_STATUSES = [
  'Scheduled',
  'In Progress',
  'Completed',
  'Needs Attention'
];

const COST_CATEGORIES = ['Feeding', 'Maintenance', 'Cleaning', 'Utilities', 'Landscaping'];

const CHART_COLORS = ['#3976a8', '#e5a13b', '#55a477', '#9875bd', '#d46d70'];

const styles = {
  page: { maxWidth: 1200, margin: '0 auto', padding: '24px 16px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 },
  card: {
    border: '1px solid #d7dce2',
    borderRadius: 10,
    padding: 20,
    background: '#fff',
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    marginRight: 0
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  input: { width: '100%', boxSizing: 'border-box', padding: 10, border: '1px solid #b9c0c8', borderRadius: 6, font: 'inherit' },
  button: { padding: '9px 14px', border: '1px solid #263746', borderRadius: 6, background: '#263746', color: '#fff', cursor: 'pointer', font: 'inherit' },
  secondaryButton: { padding: '8px 12px', border: '1px solid #7b8792', borderRadius: 6, background: '#fff', color: '#263746', cursor: 'pointer', font: 'inherit' },
  muted: { color: '#5b6570', fontSize: 14 },
  warning: { color: '#9b2c20', fontWeight: 700 },
  success: { color: '#23613a', fontWeight: 700 }
};

function EnclosureManagement() {
  const [enclosures, setEnclosures] = useState([]);
  const [selectedID, setSelectedID] = useState('');
  const [form, setForm] = useState(null);
  const [maintenance, setMaintenance] = useState([]);
  const [maintenanceForm, setMaintenanceForm] = useState(EMPTY_MAINTENANCE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [costReportRecords, setCostReportRecords] = useState([]);
  const [showCostReport, setShowCostReport] = useState(false);
  const [costReportLoading, setCostReportLoading] = useState(false);
  const [costReportLoaded, setCostReportLoaded] = useState(false);
  const [costStartDate, setCostStartDate] = useState('');
  const [costEndDate, setCostEndDate] = useState('');
  const [activeEnclosureTab, setActiveEnclosureTab] = useState('details');

  const selectedEnclosure = enclosures.find(
    enclosure => String(enclosure.enclosure_ID) === String(selectedID)
  );

  const loadEnclosures = useCallback(async (preferredID) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/enclosures');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load enclosures.');
      setEnclosures(data);
      const nextID = preferredID || selectedID || (data[0] ? String(data[0].enclosure_ID) : '');
      setSelectedID(nextID);
      const selected = data.find(item => String(item.enclosure_ID) === String(nextID));
      setForm(selected ? {
        name: selected.name || '',
        capacity: selected.capacity ?? '',
        condition_status: selected.condition_status || 'Good',
        temperature: selected.temperature ?? '',
        amenities: selected.amenities || '',
        notes: selected.notes || ''
      } : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedID]);

  async function loadCostReport() {
    setCostReportLoading(true);
    setError('');
    try {
      const results = await Promise.all(enclosures.map(async enclosure => {
        const response = await apiFetch(`/api/enclosures/${enclosure.enclosure_ID}/costs`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Could not load costs for ${enclosure.name}.`);
        }
        if (!Array.isArray(data)) {
          throw new Error(`Unexpected cost report response for ${enclosure.name}.`);
        }
        return data.map(record => ({
          ...record,
          enclosure_name: enclosure.name,
          enclosure_ID: enclosure.enclosure_ID
        }));
      }));
      setCostReportRecords(results.flat());
      setCostReportLoaded(true);
      setShowCostReport(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setCostReportLoading(false);
    }
  }

  function getDateOnly(value) {
    if (!value) return '';
    const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
  }

  const filteredCostRecords = costReportRecords.filter(record => {
    const recordDate = getDateOnly(record.cost_date);
    if (!recordDate) return false;
    if (costStartDate && recordDate < costStartDate) return false;
    if (costEndDate && recordDate > costEndDate) return false;
    return true;
  });

  const costReportRows = enclosures.map(enclosure => {
    const enclosureRecords = filteredCostRecords.filter(
      record => String(record.enclosure_ID) === String(enclosure.enclosure_ID)
    );
    const categoryTotals = Object.fromEntries(
      COST_CATEGORIES.map(category => [category, 0])
    );
    enclosureRecords.forEach(record => {
      const category = String(record.cost_category || '').trim().toLowerCase();
      const matchedCategory = COST_CATEGORIES.find(
        item => item.toLowerCase() === category
      );
      if (matchedCategory) {
        categoryTotals[matchedCategory] += Number(record.amount) || 0;
      }
    });
    const total = Object.values(categoryTotals).reduce(
      (sum, amount) => sum + amount,
      0
    );
    return { ...enclosure, categoryTotals, total };
  });

  const overallCategoryTotals = Object.fromEntries(
    COST_CATEGORIES.map(category => [
      category,
      costReportRows.reduce(
        (sum, row) => sum + row.categoryTotals[category],
        0
      )
    ])
  );

  const overallCostTotal = COST_CATEGORIES.reduce(
    (sum, category) => sum + overallCategoryTotals[category],
    0
  );

  let chartProgress = 0;

  const pieChartBackground = overallCostTotal > 0
    ? `conic-gradient(${COST_CATEGORIES.map((category, index) => {
        const percentage = (overallCategoryTotals[category] / overallCostTotal) * 100;
        const start = chartProgress;
        chartProgress += percentage;
        return `${CHART_COLORS[index]} ${start}% ${chartProgress}%`;
      }).join(', ')})`
    : '#e6e9ed';

  function exportCostReport() {
    const headers = ['Enclosure', 'Total', ...COST_CATEGORIES];
    const rows = costReportRows.map(row => [
      row.name,
      row.total.toFixed(2),
      ...COST_CATEGORIES.map(category => row.categoryTotals[category].toFixed(2))
    ]);
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'enclosure-cost-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const loadMaintenance = useCallback(async (enclosureID) => {
    if (!enclosureID) {
      setMaintenance([]);
      return;
    }
    try {
      const response = await apiFetch(`/api/enclosures/${enclosureID}/maintenance`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load maintenance history.');
      setMaintenance(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadEnclosures();
  }, []);

  useEffect(() => {
    if (selectedID) loadMaintenance(selectedID);
  }, [selectedID, loadMaintenance]);

  function selectEnclosure(enclosure) {
    setSelectedID(String(enclosure.enclosure_ID));
    setForm({
      name: enclosure.name || '',
      capacity: enclosure.capacity ?? '',
      condition_status: enclosure.condition_status || 'Good',
      temperature: enclosure.temperature ?? '',
      amenities: enclosure.amenities || '',
      notes: enclosure.notes || ''
    });
    setMessage('');
    setError('');
    setMaintenanceForm(EMPTY_MAINTENANCE);
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
  }

  async function saveEnclosure(event) {
    event.preventDefault();
    if (!selectedID || !form) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await apiFetch(`/api/enclosures/${selectedID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save enclosure details.');
      setMessage(data.message || 'Enclosure details saved.');
      await loadEnclosures(selectedID);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateMaintenanceForm(event) {
    const { name, value } = event.target;
    setMaintenanceForm(current => ({ ...current, [name]: value }));
  }

  async function addMaintenance(event) {
    event.preventDefault();
    if (!selectedID) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await apiFetch(`/api/enclosures/${selectedID}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maintenanceForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not add maintenance record.');
      setMessage(data.message || 'Maintenance record added.');
      setMaintenanceForm(EMPTY_MAINTENANCE);
      await loadMaintenance(selectedID);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading && enclosures.length === 0) {
    return <main style={styles.page}><h1>Enclosure Management</h1><p>Loading enclosure records...</p></main>;
  }

  return (
    <main style={styles.page}>
      <h1>Enclosure Management</h1>
      <p style={styles.muted}>Review enclosure conditions, capacity, temperature, amenities, and maintenance history.</p>

      {message && <p role="status" style={styles.success}>{message}</p>}
      {error && <p role="alert" style={styles.warning}>{error}</p>}

      <section style={{ ...styles.card, marginBottom: 24 }}>
        <h2>Enclosure Cost Report</h2>
        <p style={styles.muted}>Compare recorded expenses by enclosure and cost category. Costs are grouped by enclosure, not by individual animal.</p>
        <button
          type="button"
          style={styles.button}
          onClick={() => {
            if (showCostReport) setShowCostReport(false);
            else if (costReportLoaded) setShowCostReport(true);
            else loadCostReport();
          }}
          disabled={costReportLoading || enclosures.length === 0}
        >
          {costReportLoading ? 'Loading Cost Report...' : showCostReport ? 'Hide Cost Report' : 'View Cost Report'}
        </button>
        {showCostReport && (
          <div style={{ marginTop: 18 }}>
            <div style={styles.grid}>
              <label style={styles.field}>From date
                <input style={styles.input} type="date" value={costStartDate} onChange={event => setCostStartDate(event.target.value)} />
              </label>
              <label style={styles.field}>Through date
                <input style={styles.input} type="date" value={costEndDate} min={costStartDate || undefined} onChange={event => setCostEndDate(event.target.value)} />
              </label>
            </div>
            <button type="button" style={styles.secondaryButton} onClick={exportCostReport}>
              Export CSV
            </button>

            {filteredCostRecords.length === 0 ? (
              <p style={styles.muted}>No enclosure cost records were found for the selected date range.</p>
            ) : (
              <>
                <section style={{
                  marginTop: 24,
                  marginBottom: 24,
                  padding: 20,
                  border: '1px solid #d7dce2',
                  borderRadius: 10
                }}>
                  <h3>Expense Breakdown by Category</h3>
                  <p style={styles.muted}>
                    Distribution of enclosure expenses for the selected date range.
                  </p>

                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 32,
                    padding: '16px 0'
                  }}>
                    <div
                      role="img"
                      aria-label={`Pie chart showing enclosure expenses totaling $${overallCostTotal.toFixed(2)}`}
                      style={{
                        width: 230,
                        height: 230,
                        minWidth: 230,
                        borderRadius: '50%',
                        background: pieChartBackground,
                        border: '1px solid #d7dce2'
                      }}
                    />

                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                      minWidth: 210
                    }}>
                      <div style={{ marginBottom: 4 }}>
                        <p style={styles.muted}>Total Enclosure Expenses</p>
                        <h2 style={{ margin: '4px 0', fontSize: 28 }}>
                          ${overallCostTotal.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </h2>
                      </div>

                      {COST_CATEGORIES.map((category, index) => {
                        const amount = overallCategoryTotals[category];
                        const percentage = overallCostTotal > 0
                          ? (amount / overallCostTotal) * 100
                          : 0;

                        return (
                          <div key={category} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9
                          }}>
                            <span style={{
                              width: 14,
                              height: 14,
                              minWidth: 14,
                              borderRadius: 3,
                              background: CHART_COLORS[index]
                            }} />
                            <div>
                              <strong>{category}</strong>
                              <span style={{ marginLeft: 8, fontSize: 14, color: '#5b6570' }}>
                                ${amount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })} ({percentage.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <div style={{ overflowX: 'auto', marginTop: 14 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        {['Enclosure', 'Total', ...COST_CATEGORIES].map(label => (
                          <th key={label} style={{ padding: 9, borderBottom: '2px solid #d7dce2', whiteSpace: 'nowrap' }}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {costReportRows.filter(row => row.total > 0).map(row => (
                        <tr key={row.enclosure_ID}>
                          <td style={{ padding: 9, borderBottom: '1px solid #e6e9ed' }}>{row.name}</td>
                          <td style={{ padding: 9, borderBottom: '1px solid #e6e9ed', fontWeight: 700 }}>${row.total.toFixed(2)}</td>
                          {COST_CATEGORIES.map(category => (
                            <td key={category} style={{ padding: 9, borderBottom: '1px solid #e6e9ed' }}>${row.categoryTotals[category].toFixed(2)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th style={{ padding: 9, borderTop: '2px solid #d7dce2' }}>All Enclosures</th>
                        <th style={{ padding: 9, borderTop: '2px solid #d7dce2' }}>${costReportRows.reduce((sum, row) => sum + row.total, 0).toFixed(2)}</th>
                        {COST_CATEGORIES.map(category => (
                          <th key={category} style={{ padding: 9, borderTop: '2px solid #d7dce2' }}>
                            ${costReportRows.reduce((sum, row) => sum + row.categoryTotals[category], 0).toFixed(2)}
                          </th>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <h2>Enclosure Overview</h2>
      {enclosures.length === 0 ? (
        <p>No enclosure records were found.</p>
      ) : (
        <section style={styles.grid}>
          {enclosures.map(enclosure => {
            const occupancy = enclosure.occupancy_percent == null
              ? 'Not available'
              : `${Number(enclosure.occupancy_percent).toFixed(1)}%`;
            const crowded = Number(enclosure.crowding_flag) === 1;
            return (
              <article key={enclosure.enclosure_ID} style={{
                ...styles.card,
                border: String(enclosure.enclosure_ID) === String(selectedID)
                  ? '2px solid #263746'
                  : '1px solid #d7dce2'
              }}>
                <h3>{enclosure.name}</h3>
                <p style={styles.muted}>{enclosure.location || 'Location not listed'} · {enclosure.indoor_outdoor || 'Type not listed'}</p>
                <p><strong>Animals:</strong> {enclosure.animal_count} / {enclosure.capacity}</p>
                <p><strong>Occupancy:</strong> {occupancy}</p>
                <p style={crowded ? styles.warning : styles.success}>
                  {crowded ? 'Crowding alert: over 75% capacity' : 'Within crowding threshold'}
                </p>
                <p><strong>Condition:</strong> {enclosure.condition_status || 'Not recorded'}</p>
                <p><strong>Temperature:</strong> {enclosure.temperature != null && enclosure.temperature !== '' ? `${enclosure.temperature}°` : 'Not recorded'}</p>
                <p><strong>Amenities:</strong> {enclosure.amenities || 'Not listed'}</p>
                <button type="button" style={styles.secondaryButton} onClick={() => selectEnclosure(enclosure)}>
                  Manage Enclosure
                </button>
              </article>
            );
          })}
        </section>
      )}

      {selectedEnclosure && form && (
        <>
          <section style={{ marginTop: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button
                type="button"
                style={activeEnclosureTab === 'details' ? styles.button : styles.secondaryButton}
                onClick={() => setActiveEnclosureTab('details')}
                aria-pressed={activeEnclosureTab === 'details'}
              >
                Enclosure Details
              </button>
              <button
                type="button"
                style={activeEnclosureTab === 'maintenance' ? styles.button : styles.secondaryButton}
                onClick={() => setActiveEnclosureTab('maintenance')}
                aria-pressed={activeEnclosureTab === 'maintenance'}
              >
                Maintenance Records
              </button>
            </div>
          </section>

          {activeEnclosureTab === 'details' && (
          <section style={{ ...styles.card, marginTop: 24 }}>
            <h2>Edit {selectedEnclosure.name}</h2>
            <p style={styles.muted}>Basic enclosure information such as location, size, and department comes from the existing enclosure record.</p>
            <form onSubmit={saveEnclosure}>
              <div style={styles.grid}>
                <label style={styles.field}>Enclosure name
                  <input style={styles.input} name="name" value={form.name} onChange={updateForm} required maxLength={100} />
                </label>
                <label style={styles.field}>Capacity (number of animals)
                  <input style={styles.input} type="number" name="capacity" min="1" step="1" value={form.capacity} onChange={updateForm} required />
                </label>
                <label style={styles.field}>Condition
                  <select style={styles.input} name="condition_status" value={form.condition_status} onChange={updateForm}>
                    {CONDITION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label style={styles.field}>Temperature (°)
                  <input style={styles.input} type="number" step="0.1" name="temperature" value={form.temperature} onChange={updateForm} placeholder="Enter temperature" />
                </label>
              </div>
              <label style={styles.field}>Amenities
                <textarea style={{ ...styles.input, minHeight: 80 }} name="amenities" value={form.amenities} onChange={updateForm} placeholder="Water features, climbing structures, shelters, enrichment items..." />
              </label>
              <label style={styles.field}>Condition / enclosure notes
                <textarea style={{ ...styles.input, minHeight: 90 }} name="notes" value={form.notes} onChange={updateForm} placeholder="Document observations or issues..." />
              </label>
              <button type="submit" style={styles.button} disabled={saving}>{saving ? 'Saving...' : 'Save Enclosure Details'}</button>
            </form>
          </section>
          )}

          {activeEnclosureTab === 'maintenance' && (
          <>
          <section style={{ ...styles.card, marginTop: 24 }}>
            <h2>Past Maintenance Records</h2>
            {maintenance.length === 0 ? (
              <p style={styles.muted}>No maintenance records have been added for this enclosure.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead><tr>
                    {['Date', 'Type', 'Description', 'Status', 'Notes'].map(label => <th key={label} style={{ padding: 8, borderBottom: '1px solid #d7dce2' }}>{label}</th>)}
                  </tr></thead>
                  <tbody>
                    {maintenance.map(record => (
                      <tr key={record.maintenance_ID}>
                        <td style={{ padding: 8, borderBottom: '1px solid #e6e9ed' }}>{String(record.maintenance_date).slice(0, 10)}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #e6e9ed' }}>{record.maintenance_type}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #e6e9ed' }}>{record.description}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #e6e9ed' }}>{record.status}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #e6e9ed' }}>{record.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section style={{ ...styles.card, marginTop: 24 }}>
            <h2>Add Maintenance Record</h2>
            <form onSubmit={addMaintenance}>
              <div style={styles.grid}>
                <label style={styles.field}>Maintenance date
                  <input style={styles.input} type="date" name="maintenance_date" value={maintenanceForm.maintenance_date} onChange={updateMaintenanceForm} required />
                </label>
                <label style={styles.field}>Maintenance type
                  <input style={styles.input} name="maintenance_type" value={maintenanceForm.maintenance_type} onChange={updateMaintenanceForm} placeholder="Cleaning, repair, inspection..." required maxLength={100} />
                </label>
                <label style={styles.field}>Status
                  <select style={styles.input} name="status" value={maintenanceForm.status} onChange={updateMaintenanceForm}>
                    {MAINTENANCE_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
              </div>
              <label style={styles.field}>Description
                <textarea style={{ ...styles.input, minHeight: 80 }} name="description" value={maintenanceForm.description} onChange={updateMaintenanceForm} required placeholder="Describe the work performed or planned..." />
              </label>
              <label style={styles.field}>Additional notes
                <textarea style={{ ...styles.input, minHeight: 70 }} name="notes" value={maintenanceForm.notes} onChange={updateMaintenanceForm} placeholder="Optional notes..." />
              </label>
              <button type="submit" style={styles.button} disabled={saving}>{saving ? 'Saving...' : 'Add Maintenance Record'}</button>
            </form>
          </section>
          </>
          )}
        </>
      )}
    </main>
  );
}

export default EnclosureManagement;
