import { apiFetch as fetch } from '../api';
import { useEffect, useState } from 'react';

const API = 'http://localhost:5000/api';

function formatDateTime(value) {
  if (!value) return '—';
  return String(value).replace('T', ' ').slice(0, 16);
}

async function fetchParking(canManage) {
  const responses = await Promise.all([
    fetch(`${API}/parking-lots`),
    ...(canManage ? [fetch(`${API}/parking-sessions`)] : [])
  ]);

  if (responses.some(response => !response.ok)) {
    throw new Error('Could not load parking data.');
  }

  const data = await Promise.all(
    responses.map(response => response.json())
  );

  return {
    lots: data[0],
    sessions: canManage ? data[1] : []
  };
}

export default function Parking({ role }) {
  const canManage = ['admin', 'manager', 'employee'].includes(role);

  const [lots, setLots] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      setMessage('');
      setSessions([]);

      try {
        const data = await fetchParking(canManage);

        if (!cancelled) {
          setLots(data.lots);
          setSessions(data.sessions);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [canManage]);

  async function refreshParking() {
    const data = await fetchParking(canManage);
    setLots(data.lots);
    setSessions(data.sessions);
  }

  async function recordArrival(event) {
    event.preventDefault();
    if (saving || !canManage) return;

    const form = event.currentTarget;
    const fields = new FormData(form);

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API}/parking-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_ID: Number(fields.get('lot_ID')),
          license_plate: fields.get('license_plate').trim()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || 'Could not record parking arrival.'
        );
      }

      await refreshParking();
      form.reset();
      setMessage('Parking arrival recorded.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function recordDeparture(session_ID) {
    if (saving || !canManage) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `${API}/parking-sessions/${session_ID}/exit`,
        { method: 'POST' }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || 'Could not record parking departure.'
        );
      }

      await refreshParking();
      setMessage('Parking departure recorded.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1>Zoo Parking</h1>

      {loading && <p>Loading...</p>}
      {error && <p role="alert">{error}</p>}
      {canManage && message && <p role="status">{message}</p>}

      <h2>Parking Lots</h2>

      {!loading && lots.length === 0 && (
        <p>No parking lots available yet.</p>
      )}

      {lots.map(lot => (
        <article key={lot.lot_ID}>
          <h3>{lot.name}</h3>
          <p>Location: {lot.location}</p>
          <p>
            Spaces: {lot.occupied_spaces} / {lot.capacity ?? '—'} occupied
          </p>
          <p>
            Rate:{' '}
            {lot.parking_rate == null
              ? 'Not set'
              : `$${Number(lot.parking_rate).toFixed(2)}`}
          </p>
        </article>
      ))}

      {!loading && canManage && lots.length > 0 && (
        <form
          onSubmit={recordArrival}
          style={{ maxWidth: 420, margin: '30px auto' }}
        >
          <h2>Record Arrival</h2>

          <fieldset disabled={saving}>
            <legend>Vehicle details</legend>

            <p>
              <label>
                Parking lot<br />
                <select name="lot_ID" required defaultValue="">
                  <option value="" disabled>
                    Select a parking lot
                  </option>

                  {lots.map(lot => (
                    <option key={lot.lot_ID} value={lot.lot_ID}>
                      {lot.name}
                    </option>
                  ))}
                </select>
              </label>
            </p>

            <p>
              <label>
                License plate<br />
                <input
                  name="license_plate"
                  maxLength={20}
                  required
                />
              </label>
            </p>

            <button type="submit">
              {saving ? 'Saving...' : 'Record Arrival'}
            </button>
          </fieldset>
        </form>
      )}

      {canManage && (
        <>
          <h2>Parking Sessions</h2>

          {!loading && sessions.length === 0 && (
            <p>No parking sessions recorded yet.</p>
          )}

          {sessions.map(session => (
            <article key={session.session_ID}>
              <h3>{session.license_plate}</h3>
              <p>Lot: {session.lot_name}</p>
              <p>Entry: {formatDateTime(session.entry_time)}</p>
              <p>Exit: {formatDateTime(session.exit_time)}</p>

              {!session.exit_time && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => recordDeparture(session.session_ID)}
                >
                  {saving ? 'Saving...' : 'Record Departure'}
                </button>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
