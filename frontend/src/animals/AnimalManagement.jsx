import { useEffect, useState } from 'react';
import SpeciesReport from './SpeciesReport';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function AnimalManagement({ role, userEmail }) {
    const [currentTab, setCurrentTab] = useState('entry');

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

    const [species, setSpecies] = useState([]);
    const [message, setMessage] = useState('');
    const [loadingSpecies, setLoadingSpecies] = useState(true);

    const [showAddSpecies, setShowAddSpecies] = useState(false);
    const [newSpecies, setNewSpecies] = useState({
        common_name: '',
        scientific_name: '',
        endangered_status: '',
        enclosure_ID: ''
    });

    const [breedingAnimals, setBreedingAnimals] = useState([]);
    const [breedingLoading, setBreedingLoading] = useState(false);
    const [breedingError, setBreedingError] = useState('');

    // Fetch species for the Animal Entry Form
    useEffect(() => {
        async function fetchSpecies() {
            try {
                const response = await fetch(`${API_URL}/api/species`);

                if (!response.ok) {
                    throw new Error('Could not load species.');
                }

                const result = await response.json();
                setSpecies(result);
            } catch (error) {
                setMessage(`Error: ${error.message}`);
            } finally {
                setLoadingSpecies(false);
            }
        }

        fetchSpecies();
    }, []);

    // Fetch animals in the Breeding Program
    useEffect(() => {
        if (currentTab !== 'breeding') return;

        async function fetchBreedingAnimals() {
            setBreedingLoading(true);
            setBreedingError('');

            try {
                const response = await fetch(`${API_URL}/api/breeding-program`);

                if (!response.ok) {
                    throw new Error('Could not load breeding animals.');
                }

                const result = await response.json();
                setBreedingAnimals(result);
            } catch (error) {
                setBreedingError(error.message);
            } finally {
                setBreedingLoading(false);
            }
        }

        fetchBreedingAnimals();
    }, [currentTab]);

    // Handle form input changes
    // Automatically populate enclosure when species is selected
    function handleChange(event) {
        const { name, value } = event.target;

        if (name === 'species_ID') {
            const selectedSpecies = species.find(
                (item) => Number(item.species_ID) === Number(value)
            );

            setFormData({
                ...formData,
                species_ID: value,
                enclosure_ID: selectedSpecies?.enclosure_ID ?? ''
            });
        } else {
            setFormData({
                ...formData,
                [name]: value
            });
        }
    }

    // Submit new animal
    async function handleSubmit(event) {
        event.preventDefault();
        setMessage('');

        try {
            const response = await fetch(`${API_URL}/api/animals`, {
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

    // Add a new species to the database
    async function handleAddSpecies(event) {
        event.preventDefault();
        setMessage('');

        try {
            const response = await fetch(`${API_URL}/api/species`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...newSpecies,
                    common_name: newSpecies.common_name.trim(),
                    scientific_name: newSpecies.scientific_name.trim(),
                    enclosure_ID: Number(newSpecies.enclosure_ID)
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Could not add species.');
            }

            // Refresh the species dropdown
            const speciesResponse = await fetch(`${API_URL}/api/species`);

            if (!speciesResponse.ok) {
                throw new Error('Species was added, but the dropdown could not refresh.');
            }

            const updatedSpecies = await speciesResponse.json();
            setSpecies(updatedSpecies);

            // Automatically select the newly added species
            setFormData({
                ...formData,
                species_ID: String(result.species_ID),
                enclosure_ID: newSpecies.enclosure_ID
            });

            setNewSpecies({
                common_name: '',
                scientific_name: '',
                endangered_status: '',
                enclosure_ID: ''
            });

            setShowAddSpecies(false);
            setMessage('Species added successfully! It is now selected.');

        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
    }

    return (
        <div className="animal-management">

            {/* Navigation Tabs */}
            <div>
                <button
                    type="button"
                    onClick={() => setCurrentTab('entry')}
                >
                    {currentTab === 'entry'
                        ? <strong>Animal Entry Form</strong>
                        : 'Animal Entry Form'}
                </button>

                <button
                    type="button"
                    onClick={() => setCurrentTab('breeding')}
                >
                    {currentTab === 'breeding'
                        ? <strong>Breeding Program</strong>
                        : 'Breeding Program'}
                </button>

                &nbsp;&nbsp;

                <button
                    type="button"
                    onClick={() => setCurrentTab('report')}
                >
                    {currentTab === 'report'
                        ? <strong>Species Population Report</strong>
                        : 'Species Population Report'}
                </button>
            </div>

            <hr />

            {/* Species Population Report */}
            {currentTab === 'report' ? (
                <SpeciesReport role={role} userEmail={userEmail} />

            ) : currentTab === 'breeding' ? (

                /* Breeding Program */
                <>
                    <h1>Breeding Program</h1>
                    <p>Animals currently participating in the breeding program.</p>

                    {breedingLoading && (
                        <p>Loading breeding animals...</p>
                    )}

                    {breedingError && (
                        <p>Error: {breedingError}</p>
                    )}

                    {!breedingLoading && !breedingError && (
                        <>
                            {breedingAnimals.length === 0 ? (
                                <p>No animals are currently in the breeding program.</p>
                            ) : (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Animal</th>
                                            <th>Species</th>
                                            <th>Age</th>
                                            <th>Gender</th>
                                            <th>Enclosure</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {breedingAnimals.map((animal) => (
                                            <tr key={animal.animal_ID}>
                                                <td>{animal.name}</td>
                                                <td>{animal.common_name}</td>
                                                <td>{animal.age}</td>
                                                <td>{animal.gender}</td>
                                                <td>{animal.enclosure_name}</td>
                                                <td>{animal.breeding_status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}
                </>

            ) : (

                /* Animal Entry Form */
                <>
                    <h1>Animal Management</h1>
                    <p>Enter the animal's information below.</p>

                    {/* Add New Species Form */}
                    {showAddSpecies && (
                        <form onSubmit={handleAddSpecies}>
                            <h2>Add New Species</h2>

                            <label htmlFor="common_name">Common Name:</label>
                            <input
                                id="common_name"
                                value={newSpecies.common_name}
                                onChange={(e) => setNewSpecies({
                                    ...newSpecies,
                                    common_name: e.target.value
                                })}
                                maxLength="100"
                                required
                            />

                            <label htmlFor="scientific_name">Scientific Name:</label>
                            <input
                                id="scientific_name"
                                value={newSpecies.scientific_name}
                                onChange={(e) => setNewSpecies({
                                    ...newSpecies,
                                    scientific_name: e.target.value
                                })}
                                maxLength="100"
                                required
                            />

                            <label htmlFor="endangered_status">Endangered Status:</label>
                            <input
                                id="endangered_status"
                                value={newSpecies.endangered_status}
                                onChange={(e) => setNewSpecies({
                                    ...newSpecies,
                                    endangered_status: e.target.value
                                })}
                            />

                            <label htmlFor="new_enclosure_ID">Enclosure ID:</label>
                            <input
                                id="new_enclosure_ID"
                                type="number"
                                min="1"
                                value={newSpecies.enclosure_ID}
                                onChange={(e) => setNewSpecies({
                                    ...newSpecies,
                                    enclosure_ID: e.target.value
                                })}
                                required
                            />

                            <button type="submit">Save Species</button>

                            <button
                                type="button"
                                onClick={() => setShowAddSpecies(false)}
                            >
                                Cancel
                            </button>
                        </form>
                    )}

                    <form onSubmit={handleSubmit}>

                        <label htmlFor="name">Animal Name:</label>
                        <input
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            maxLength="100"
                        />

                        <label htmlFor="species_ID">Species:</label>
                        <select
                            id="species_ID"
                            name="species_ID"
                            value={formData.species_ID}
                            onChange={handleChange}
                            required
                            disabled={loadingSpecies || species.length === 0}
                        >
                            <option value="">
                                {loadingSpecies
                                    ? 'Loading species...'
                                    : 'Select a species'}
                            </option>

                            {species.map((item) => (
                                <option
                                    key={item.species_ID}
                                    value={item.species_ID}
                                >
                                    {item.common_name}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={() => setShowAddSpecies(!showAddSpecies)}
                        >
                            {showAddSpecies ? 'Cancel' : 'Add New Species'}
                        </button>

                        <label htmlFor="enclosure_ID">Assigned Enclosure ID:</label>
                        <input
                            id="enclosure_ID"
                            name="enclosure_ID"
                            type="number"
                            value={formData.enclosure_ID}
                            readOnly
                            placeholder="Automatically assigned"
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
                        <select
                            id="gender"
                            name="gender"
                            value={formData.gender}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select Gender</option>
                            <option value="M">M</option>
                            <option value="F">F</option>
                        </select>

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

                    {message && (
                        <p role="status">{message}</p>
                    )}
                </>
            )}

        </div>
    );
}

export default AnimalManagement;
