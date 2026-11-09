import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import './VisitorAnimalDirectory.css';

const API_URL = 'http://localhost:5000';

function formatDate(value) {
  if (!value) return 'Not available';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString();
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
          {animals.map((animal) => (
            <article
              className="visitor-animal-card"
              key={animal.animal_ID}
            >
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
          ))}
        </div>
      )}
    </main>
  );
}

export default VisitorAnimalDirectory;
