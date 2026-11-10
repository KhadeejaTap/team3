import { useCallback, useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function AttractionManagement() {
    const eventDateRef = useRef(null);
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        location: '',
        attr_datetime: '',
        capacity: '',
        description: '',
    });
    const [message, setMessage] = useState('');
    const [attractions, setAttractions] = useState([]);
    const [isLoadingAttractions, setIsLoadingAttractions] = useState(true);
    const [attractionError, setAttractionError] = useState('');

    const loadAttractions = useCallback(async () => {
        setIsLoadingAttractions(true);
        setAttractionError('');

        try {
            const response = await fetch(`${API_URL}/api/attractions`);
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Could not load attractions.');
            }

            setAttractions(result);
        } catch (error) {
            setAttractionError(error.message || 'Could not load attractions.');
        } finally {
            setIsLoadingAttractions(false);
        }
    }, []);

    useEffect(() => {
        loadAttractions();
    }, [loadAttractions]);

    function handleChange(event) {
        setFormData({
            ...formData,
            [event.target.name]: event.target.value
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setMessage('');

        try {
            const response = await fetch(`${API_URL}/api/attractions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...formData,
                    capacity: formData.capacity === '' ? null : Number(formData.capacity),
                })
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Could not save attraction.');
            }

            setMessage(`Attraction saved successfully! ID: ${result.attr_ID}`);
            setFormData({
                name: '',
                type: '',
                location: '',
                attr_datetime: '',
                capacity: '',
                description: '',
            });
            await loadAttractions();
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
    }
    return (
        <div className="attraction-management">
            <h1>Exhibits & Shows Management</h1>
            <p>Add each exhibit or show as a separate attraction.</p>

            <form onSubmit={handleSubmit}>
                <div className="attraction-form-field">
                    <label htmlFor="name">Exhibit or Show Name:</label>
                    <input
                        id="name"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        maxLength="100"
                    />
                </div>

                <div className="attraction-form-field">
                    <label htmlFor="type">Type:</label>
                    <select
                        id="type"
                        name="type"
                        value={formData.type}
                        onChange={handleChange}
                    >
                        <option value="">Select a type</option>
                        <option value="Exhibit">Exhibit</option>
                        <option value="Live Show">Live Show</option>
                        <option value="Tour">Tour</option>
                        <option value="Interactive">Interactive</option>
                    </select>
                </div>

                <div className="attraction-form-field">
                    <label htmlFor="location">Location:</label>
                    <input
                        id="location"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        maxLength="40"
                    />
                </div>

                <div className="attraction-form-field">
                    <label htmlFor="capacity">Capacity:</label>
                    <input
                        id="capacity"
                        name="capacity"
                        type="number"
                        min="0"
                        step="1"
                        value={formData.capacity}
                        onChange={handleChange}
                    />
                </div>

                <div className="attraction-form-field">
                    <label htmlFor="attr_datetime">Event Date:</label>
                    <div className="attraction-date-input-row">
                        <input
                            ref={eventDateRef}
                            id="attr_datetime"
                            name="attr_datetime"
                            type="date"
                            value={formData.attr_datetime}
                            onChange={handleChange}
                        />
                        <button
                            className="attraction-date-picker-button"
                            type="button"
                            aria-label="Open event date calendar"
                            title="Open calendar"
                            onClick={() => {
                                const dateInput = eventDateRef.current;
                                if (!dateInput) return;

                                if (typeof dateInput.showPicker === 'function') {
                                    dateInput.showPicker();
                                } else {
                                    dateInput.focus();
                                    dateInput.click();
                                }
                            }}
                        >
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                width="20"
                                height="20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect x="3" y="5" width="18" height="16" rx="2" />
                                <path d="M16 3v4M8 3v4M3 11h18" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="attraction-form-field">
                    <label htmlFor="description">Description:</label>
                    <input
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        maxLength="500"
                    />
                </div>

                <button type="submit">Save Attraction</button>
            </form>
            {message && <p role="status">{message}</p>}

            <section aria-labelledby="created-attractions-heading">
                <h2 id="created-attractions-heading">Created Attractions</h2>
                {isLoadingAttractions ? (
                    <p role="status">Loading attractions...</p>
                ) : attractionError ? (
                    <p role="alert">Error: {attractionError}</p>
                ) : attractions.length === 0 ? (
                    <p>No attractions have been created yet.</p>
                ) : (
                    <div className="attraction-table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th scope="col">ID</th>
                                    <th scope="col">Name</th>
                                    <th scope="col">Type</th>
                                    <th scope="col">Location</th>
                                    <th scope="col">Opening Date</th>
                                    <th scope="col">Capacity</th>
                                    <th scope="col">Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attractions.map((attraction) => (
                                    <tr key={attraction.attr_ID}>
                                        <td>{attraction.attr_ID}</td>
                                        <td>{attraction.name || '-'}</td>
                                        <td>{attraction.type || '-'}</td>
                                        <td>{attraction.location || '-'}</td>
                                        <td>{attraction.attr_datetime || '-'}</td>
                                        <td>{attraction.capacity ?? '-'}</td>
                                        <td>{attraction.description || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

export default AttractionManagement;