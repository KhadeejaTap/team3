import { useState } from 'react';

function AnimalManagement() {
    const [formData, setFormData] = useState({
        name: '',
        species_ID: '',
        enclosure_ID: '',
        age: '',
        gender: '',
        weight: '',
        arrival_date: '',
        breeding_status: ''
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
            const response = await fetch('http://localhost:5000/api/animals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...formData,
                    species_ID: Number(formData.species_ID),
                    enclosure_ID: Number(formData.enclosure_ID),
                    age: formData.age === '' ? null : Number(formData.age),
                    weight: formData.weight === '' ? null : Number(formData.weight)
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Could not save animal.');
            }

            setMessage(`Animal saved successfully! ID: ${result.animal_ID}`);

            setFormData({
                name: '',
                species_ID: '',
                enclosure_ID: '',
                age: '',
                gender: '',
                weight: '',
                arrival_date: '',
                breeding_status: ''
            });
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
    }

    return (
        <div className="animal-management">
            <h1>Animal Query</h1>
            <p>Enter the animal's information below.</p>

            <form onSubmit={handleSubmit}>
                <label htmlFor="name">Animal Name:</label>
                <input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    maxLength="100"
                />

                <label htmlFor="species_ID">Species ID:</label>
                <input
                    id="species_ID"
                    name="species_ID"
                    type="number"
                    min="1"
                    value={formData.species_ID}
                    onChange={handleChange}
                    required
                />

                <label htmlFor="enclosure_ID">Enclosure ID:</label>
                <input
                    id="enclosure_ID"
                    name="enclosure_ID"
                    type="number"
                    min="1"
                    value={formData.enclosure_ID}
                    onChange={handleChange}
                    required
                />

                <label htmlFor="age">Age:</label>
                <input
                    id="age"
                    name="age"
                    type="number"
                    min="0"
                    value={formData.age}
                    onChange={handleChange}
                />

                <label htmlFor="gender">Gender:</label>
                <input
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    maxLength="20"
                />

                <label htmlFor="weight">Weight:</label>
                <input
                    id="weight"
                    name="weight"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.weight}
                    onChange={handleChange}
                />

                <label htmlFor="arrival_date">Arrival Date:</label>
                <input
                    id="arrival_date"
                    name="arrival_date"
                    type="date"
                    value={formData.arrival_date}
                    onChange={handleChange}
                />

                <label htmlFor="breeding_status">Breeding Status:</label>
                <input
                    id="breeding_status"
                    name="breeding_status"
                    value={formData.breeding_status}
                    onChange={handleChange}
                    maxLength="50"
                />

                <button type="submit">Save Animal</button>
            </form>

            {message && <p role="status">{message}</p>}
        </div>
    );
}

export default AnimalManagement;