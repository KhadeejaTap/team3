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

    loadAnimals();

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
