import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import './VisitorAnimalDirectory.css';

const API_URL = (
  import.meta.env.VITE_API_URL ||
  'https://zoo-team3-api-fbamfnfxfdekbdgr.centralus-01.azurewebsites.net'
).replace(/\/+$/, '');

const animalImageFiles = import.meta.glob(
  './images/animals/*.{jpg,jpeg,png,webp}',
  {
    eager: true,
    query: '?url',
    import: 'default'
  }
);

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const animalImages = Object.fromEntries(
  Object.entries(animalImageFiles).map(([path, imageUrl]) => {
    const fileName = path.split('/').pop().replace(/\.[^.]+$/, '');
    return [normalizeName(fileName), imageUrl];
  })
);

function formatDate(value) {
  if (!value) return 'Not available';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString();
}

function getAnimalImage(animal) {
  if (animal.image_url) {
    if (/^https?:\/\//i.test(animal.image_url)) {
      return animal.image_url;
    }

    return `${API_URL}${animal.image_url.startsWith('/') ? '' : '/'}${animal.image_url}`;
  }

  return animalImages[normalizeName(animal.name)] || '';
}

function VisitorAnimalDirectory() {
  const [animals, setAnimals] = useState([]);
  const [feedingSchedule, setFeedingSchedule] = useState([]);
  const [scheduleError, setScheduleError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadAnimals() {
      try {
        const response = await apiFetch(
          `${API_URL}/api/public/animals`
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load animals. Server returned ${response.status}.`
          );
        }

        const data = await response.json();

        if (!cancelled) {
          setAnimals(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to connect to the server.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    async function loadFeedingSchedule() {
      try {
        const response = await apiFetch(`${API_URL}/api/public/feeding-schedule`);
        if (!response.ok) {
          throw new Error(`Unable to load feeding schedule. Server returned ${response.status}.`);
        }
        const data = await response.json();
        if (!cancelled) {
          setFeedingSchedule(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setScheduleError(err.message || 'Unable to load the feeding schedule.');
        }
      }
    }

    loadAnimals();
    loadFeedingSchedule();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="visitor-animals">
        <p>Loading animals...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="visitor-animals">
        <p className="visitor-animals-error" role="alert">
          {error}
        </p>
      </main>
    );
  }

  return (
    <main className="visitor-animals">
      <header className="visitor-animals-header">
        <h1>Meet the Animals</h1>
        <p>
          Get to know the animals who call Cougar Zoo home.
        </p>
      </header>

      <section className="visitor-feeding-schedule" style={{ margin: '24px 0 32px' }}>
        <h2>Daily Feeding Schedule</h2>
        <p>See when the animals in each enclosure are scheduled to eat.</p>
        {scheduleError ? (
          <p className="visitor-animals-error" role="alert">{scheduleError}</p>
        ) : feedingSchedule.length === 0 ? (
          <p>There are no feeding times listed right now.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {Object.entries(
              feedingSchedule.reduce((groups, item) => {
                const key = item.enclosure_name || 'Unassigned enclosure';
                if (!groups[key]) groups[key] = [];
                groups[key].push(item);
                return groups;
              }, {})
            ).map(([enclosureName, items]) => (
              <article key={enclosureName} style={{ border: '1px solid #d7dce2', borderRadius: 10, padding: 16, background: '#fff' }}>
                <h3>{enclosureName}</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {items.map(item => (
                    <li key={item.feeding_ID} style={{ padding: '10px 0', borderTop: '1px solid #e5e7eb' }}>
                      <strong>{item.display_time || item.feeding_time || 'Time not listed'}</strong>
                      <div>{item.animal_name}</div>
                      <small>{item.food_name || 'Food not listed'}{item.amount != null ? ` · Amount: ${item.amount}` : ''}</small>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      {animals.length === 0 ? (
        <p>No animal records are available right now.</p>
      ) : (
        <div className="visitor-animal-grid">
          {animals.map((animal) => {
            const image = getAnimalImage(animal);

            return (
              <article
                className="visitor-animal-card"
                key={animal.animal_ID}
              >
                {image ? (
                  <img
                    className="visitor-animal-image"
                    src={image}
                    alt={animal.name}
                    onError={(event) => {
                      const fallback = animalImages[normalizeName(animal.name)];
                      if (fallback && event.currentTarget.src !== fallback) {
                        event.currentTarget.src = fallback;
                      } else {
                        event.currentTarget.style.display = 'none';
                      }
                    }}
                  />
                ) : (
                  <div className="visitor-animal-image-placeholder">
                    Photo unavailable
                  </div>
                )}

                <h2>{animal.name}</h2>

                <p className="animal-species">
                  {animal.common_name || 'Species unknown'}
                </p>

                <p className="animal-scientific-name">
                  {animal.scientific_name || 'Scientific name unavailable'}
                </p>

                <dl>
                  <div>
                    <dt>Enclosure</dt>
                    <dd>{animal.enclosure_name || 'Not available'}</dd>
                  </div>

                  <div>
                    <dt>Age</dt>
                    <dd>{animal.age ?? 'Not available'}</dd>
                  </div>

                  <div>
                    <dt>Arrival date</dt>
                    <dd>{formatDate(animal.arrival_date)}</dd>
                  </div>

                  <div>
                    <dt>Gender</dt>
                    <dd>{animal.gender || 'Not available'}</dd>
                  </div>

                  <div>
                    <dt>Conservation status</dt>
                    <dd>{animal.endangered_status || 'Unknown'}</dd>
                  </div>

                  <div>
                    <dt>Weight</dt>
                    <dd>
                      {animal.weight == null
                        ? 'Not available'
                        : `${animal.weight} ${animal.weight_unit || ''}`.trim()}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default VisitorAnimalDirectory;
