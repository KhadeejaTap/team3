import { useState } from 'react';

function AttractionManagement() {
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        location: '',
        attr_datetime: '',
        capacity: '',
        description: '',
    });
    const [message, setMessage] = useState('');

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
            const response = await fetch('http://localhost:5000/api/attractions', {
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
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
    }
    return (
        <div className="attraction-management">
            <h1>Attraction Management</h1>
            <p>Enter the attraction's information below.</p>

            <form onSubmit={handleSubmit}>
                <div className="attraction-form-field">
                    <label htmlFor="name">Attraction Name:</label>
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
                    <input
                        id="type"
                        name="type"
                        value={formData.type}
                        onChange={handleChange}
                        maxLength="30"
                    />
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
                    <label htmlFor="attr_datetime">Attraction Date:</label>
                    <input
                        id="attr_datetime"
                        name="attr_datetime"
                        type="date"
                        value={formData.attr_datetime}
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

                <button type="submit">Save Attraction</button>
            </form>
            {message && <p role="status">{message}</p>}
        </div>
    );
}

export default AttractionManagement;