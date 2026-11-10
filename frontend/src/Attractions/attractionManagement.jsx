import { useCallback, useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function formatAttractionDateTime(value) {
    if (!value) return '-';

    const match = String(value).match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?Z?)?$/
    );
    if (!match) return String(value);

    const [, year, month, day, hour, minute] = match;
    const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour || 0),
        Number(minute || 0)
    );
    const options = hour
        ? {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }
        : { month: 'short', day: 'numeric', year: 'numeric' };

    return date.toLocaleString('en-US', options);
}

function getAttractionFormData(attraction) {
    const dateTimeMatch = String(attraction.attr_datetime || '').match(
        /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/
    );

    return {
        name: attraction.name || '',
        type: attraction.type || '',
        location: attraction.location || '',
        event_date: dateTimeMatch?.[1] || '',
        event_time: dateTimeMatch?.[2] || '',
        capacity: attraction.capacity ?? '',
        description: attraction.description || '',
    };
}

const EMPTY_FORM = {
    name: '',
    type: '',
    location: '',
    event_date: '',
    event_time: '',
    capacity: '',
    description: '',
};

function AttractionManagement() {
    const eventDateRef = useRef(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [editingAttractionId, setEditingAttractionId] = useState(null);
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

        if (Boolean(formData.event_date) !== Boolean(formData.event_time)) {
            setMessage('Enter both an event date and time, or leave both blank.');
            return;
        }

        try {
            const { event_date, event_time, ...attractionFields } = formData;
            const response = await fetch(
                editingAttractionId
                    ? `${API_URL}/api/attractions/${editingAttractionId}`
                    : `${API_URL}/api/attractions`,
                {
                    method: editingAttractionId ? 'PUT' : 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ...attractionFields,
                        attr_datetime: event_date
                            ? `${event_date} ${event_time}:00`
                            : null,
                        capacity: formData.capacity === '' ? null : Number(formData.capacity),
                    })
                }
            );
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Could not save attraction.');
            }

            setMessage(
                editingAttractionId
                    ? 'Attraction updated successfully.'
                    : `Attraction saved successfully! ID: ${result.attr_ID}`
            );
            setFormData(EMPTY_FORM);
            setEditingAttractionId(null);
            await loadAttractions();
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
    }

    function editAttraction(attraction) {
        setFormData(getAttractionFormData(attraction));
        setEditingAttractionId(attraction.attr_ID);
        setMessage('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function cancelEdit() {
        setFormData(EMPTY_FORM);
        setEditingAttractionId(null);
        setMessage('');
    }

    return (
        <div className="attraction-management">
            <h1>Exhibits & Shows Management</h1>
            <p>Add each exhibit or show as a separate attraction.</p>

            <form onSubmit={handleSubmit}>
                <h2>{editingAttractionId ? 'Edit Exhibit or Show' : 'Add Exhibit or Show'}</h2>
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
                    <label htmlFor="event_date">Event Date:</label>
                    <div className="attraction-date-input-row">
                        <input
                            ref={eventDateRef}
                            id="event_date"
                            name="event_date"
                            type="date"
                            value={formData.event_date}
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
                    <label htmlFor="event_time">Event Time:</label>
                    <input
                        id="event_time"
                        name="event_time"
                        type="time"
                        value={formData.event_time}
                        onChange={handleChange}
                    />
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

                <button type="submit">
                    {editingAttractionId ? 'Update Attraction' : 'Save Attraction'}
                </button>
                {editingAttractionId && (
                    <button type="button" onClick={cancelEdit}>Cancel</button>
                )}
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
                                    <th scope="col">Event Date & Time</th>
                                    <th scope="col">Capacity</th>
                                    <th scope="col">Description</th>
                                    <th scope="col">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attractions.map((attraction) => (
                                    <tr key={attraction.attr_ID}>
                                        <td>{attraction.attr_ID}</td>
                                        <td>{attraction.name || '-'}</td>
                                        <td>{attraction.type || '-'}</td>
                                        <td>{attraction.location || '-'}</td>
                                        <td>{formatAttractionDateTime(attraction.attr_datetime)}</td>
                                        <td>{attraction.capacity ?? '-'}</td>
                                        <td>{attraction.description || '-'}</td>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => editAttraction(attraction)}
                                                disabled={editingAttractionId === attraction.attr_ID}
                                            >
                                                Edit
                                            </button>
                                        </td>
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