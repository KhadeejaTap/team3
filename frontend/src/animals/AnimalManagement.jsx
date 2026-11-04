import { useEffect, useState } from 'react';
import SpeciesReport from './SpeciesReport';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const EMPTY_FORM = {
    name: '',
    species_ID: '',
    enclosure_ID: '',
    age: '',
    gender: '',
    weight: '',
    weight_unit: 'lbs',
    arrival_date: '',
    breeding_status: 'Not Breeding'
};

function AnimalManagement({ role, userEmail }) {
    const [currentTab, setCurrentTab] = useState('entry');
    const [formData, setFormData] = useState(EMPTY_FORM);
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

    // Add/update mode and existing-animal selection
    const [isEditing, setIsEditing] = useState(false);
    const [animals, setAnimals] = useState([]);
    const [loadingAnimals, setLoadingAnimals] = useState(false);
    const [selectedAnimalID, setSelectedAnimalID] = useState('');

    useEffect(() => {
        async function fetchSpecies() {
            try {
                const response = await fetch(`${API_URL}/api/species`);
                if (!response.ok) throw new Error('Could not load species.');
                setSpecies(await response.json());
            } catch (error) {
                setMessage(`Error: ${error.message}`);
            } finally {
                setLoadingSpecies(false);
            }
        }
        fetchSpecies();
    }, []);

    useEffect(() => {
        if (currentTab !== 'breeding') return;

        async function fetchBreedingAnimals() {
            setBreedingLoading(true);
            setBreedingError('');
            try {
                const response = await fetch(`${API_URL}/api/breeding-program`);
                if (!response.ok) throw new Error('Could not load breeding animals.');
                setBreedingAnimals(await response.json());
            } catch (error) {
                setBreedingError(error.message);
            } finally {
                setBreedingLoading(false);
            }
        }
        fetchBreedingAnimals();
    }, [currentTab]);

    // Load existing records when the user chooses update mode.
    useEffect(() => {
        if (!isEditing) return;

        async function fetchAnimals() {
            setLoadingAnimals(true);
            setMessage('');
            try {
                const response = await fetch(`${API_URL}/api/animals`);
                if (!response.ok) throw new Error('Could not load existing animals.');
                const result = await response.json();
                setAnimals(result);
            } catch (error) {
                setMessage(`Error: ${error.message}`);
            } finally {
                setLoadingAnimals(false);
            }
        }
        fetchAnimals();
    }, [isEditing]);

    function handleChange(event) {
        const { name, value } = event.target;

        if (name === 'species_ID') {
            const selectedSpecies = species.find(
                (item) => Number(item.species_ID) === Number(value)
            );
            setFormData((previous) => ({
                ...previous,
                species_ID: value,
                enclosure_ID: selectedSpecies?.enclosure_ID ?? ''
            }));
        } else {
            setFormData((previous) => ({ ...previous, [name]: value }));
        }
    }

    function handleAnimalSelection(event) {
        const animalID = event.target.value;
        setSelectedAnimalID(animalID);

        if (!animalID) {
            setFormData(EMPTY_FORM);
            return;
        }

        const animal = animals.find(
            (item) => String(item.animal_ID) === String(animalID)
        );

        if (!animal) return;

        setFormData({
            name: animal.name ?? '',
            species_ID: String(animal.species_ID ?? ''),
            enclosure_ID: String(animal.enclosure_ID ?? ''),
            age: animal.age ?? '',
            gender: animal.gender ?? '',
            weight: animal.weight ?? '',
            weight_unit: animal.weight_unit ?? 'lbs',
            arrival_date: animal.arrival_date
                ? String(animal.arrival_date).slice(0, 10)
                : '',
            breeding_status:
                String(animal.breeding_status).toLowerCase() === 'breeding'
                    ? 'Breeding'
                    : 'Not Breeding'
        });
        setMessage(`Loaded ${animal.name}. Make your changes and select Update Animal Record.`);
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setMessage('');

        if (isEditing && !selectedAnimalID) {
            setMessage('Please select an existing animal to update.');
            return;
        }

        const payload = {
            ...formData,
            species_ID: Number(formData.species_ID),
            enclosure_ID: Number(formData.enclosure_ID),
            age: formData.age === '' ? null : Number(formData.age),
            weight: formData.weight === '' ? null : Number(formData.weight)
        };

        try {
            const response = await fetch(
                isEditing
                    ? `${API_URL}/api/animals/${selectedAnimalID}`
                    : `${API_URL}/api/animals`,
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || (isEditing
                    ? 'Could not update animal.'
                    : 'Could not save animal.'));
            }

            setMessage(isEditing
                ? 'Animal record updated successfully!'
                : `Animal saved successfully! ID: ${result.animal_ID}`);

            if (isEditing) {
                // Refresh the list so the selected record reflects its latest values.
                const refreshResponse = await fetch(`${API_URL}/api/animals`);
                if (refreshResponse.ok) setAnimals(await refreshResponse.json());
            } else {
                setFormData(EMPTY_FORM);
            }
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
    }

    async function handleAddSpecies(event) {
        event.preventDefault();
        setMessage('');

        try {
            const response = await fetch(`${API_URL}/api/species`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

            const speciesResponse = await fetch(`${API_URL}/api/species`);
            if (!speciesResponse.ok) {
                throw new Error('Species was added, but the dropdown could not refresh.');
            }

            setSpecies(await speciesResponse.json());
            setFormData((previous) => ({
                ...previous,
                species_ID: String(result.species_ID),
                enclosure_ID: newSpecies.enclosure_ID
            }));
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

    function switchMode(nextIsEditing) {
        setIsEditing(nextIsEditing);
        setSelectedAnimalID('');
        setFormData(EMPTY_FORM);
        setMessage('');
    }

    return (
        <div className="animal-management">
            <div>
                <button type="button" onClick={() => setCurrentTab('entry')}>
                    {currentTab === 'entry' ? <strong>Animal Management</strong> : 'Animal Management'}
                </button>
                <button type="button" onClick={() => setCurrentTab('breeding')}>
                    {currentTab === 'breeding' ? <strong>Breeding Program</strong> : 'Breeding Program'}
                </button>
                <button type="button" onClick={() => setCurrentTab('report')}>
                    {currentTab === 'report' ? <strong>Species Population Report</strong> : 'Species Population Report'}
                </button>
            </div>

            <hr />

            {currentTab === 'report' ? (
                <SpeciesReport role={role} userEmail={userEmail} />
            ) : currentTab === 'breeding' ? (
                <>
                    <h1>Breeding Program</h1>
                    <p>Animals currently participating in the breeding program.</p>
                    {breedingLoading && <p>Loading breeding animals...</p>}
                    {breedingError && <p>Error: {breedingError}</p>}
                    {!breedingLoading && !breedingError && (
                        breedingAnimals.length === 0 ? (
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
                        )
                    )}
                </>
            ) : (
                <>
                    <h1>Animal Management</h1>
                    <p>Add a new animal or update an existing animal record.</p>

                    <div>
                        <button type="button" onClick={() => switchMode(false)}>
                            Add New Animal
                        </button>
                        <button type="button" onClick={() => switchMode(true)}>
                            Update Existing Animal Record
                        </button>
                    </div>

                    {isEditing && (
                        <>
                            <label htmlFor="existingAnimal">Select Animal to Update:</label>
                            <select
                                id="existingAnimal"
                                value={selectedAnimalID}
                                onChange={handleAnimalSelection}
                                disabled={loadingAnimals}
                            >
                                <option value="">
                                    {loadingAnimals ? 'Loading animals...' : 'Select an animal'}
                                </option>
                                {animals.map((animal) => (
                                    <option key={animal.animal_ID} value={animal.animal_ID}>
                                        {animal.name} (ID: {animal.animal_ID})
                                    </option>
                                ))}
                            </select>
                        </>
                    )}

                    {showAddSpecies && (
                        <form onSubmit={handleAddSpecies}>
                            <h2>Add New Species</h2>
                            <label htmlFor="common_name">Common Name:</label>
                            <input
                                id="common_name"
                                value={newSpecies.common_name}
                                onChange={(e) => setNewSpecies({ ...newSpecies, common_name: e.target.value })}
                                maxLength="100"
                                required
                            />

                            <label htmlFor="scientific_name">Scientific Name:</label>
                            <input
                                id="scientific_name"
                                value={newSpecies.scientific_name}
                                onChange={(e) => setNewSpecies({ ...newSpecies, scientific_name: e.target.value })}
                                maxLength="100"
                                required
                            />

                            <label htmlFor="endangered_status">Endangered Status:</label>
                            <input
                                id="endangered_status"
                                value={newSpecies.endangered_status}
                                onChange={(e) => setNewSpecies({ ...newSpecies, endangered_status: e.target.value })}
                            />

                            <label htmlFor="new_enclosure_ID">Enclosure ID:</label>
                            <input
                                id="new_enclosure_ID"
                                type="number"
                                min="1"
                                value={newSpecies.enclosure_ID}
                                onChange={(e) => setNewSpecies({ ...newSpecies, enclosure_ID: e.target.value })}
                                required
                            />

                            <button type="submit">Save Species</button>
                            <button type="button" onClick={() => setShowAddSpecies(false)}>Cancel</button>
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
                            required
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
                                {loadingSpecies ? 'Loading species...' : 'Select a species'}
                            </option>
                            {species.map((item) => (
                                <option key={item.species_ID} value={item.species_ID}>
                                    {item.common_name}
                                </option>
                            ))}
                        </select>

                        <button type="button" onClick={() => setShowAddSpecies(!showAddSpecies)}>
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

                        <label htmlFor="weight_unit">Weight Unit:</label>
                        <select
                            id="weight_unit"
                            name="weight_unit"
                            value={formData.weight_unit}
                            onChange={handleChange}
                            required
                        >
                            <option value="lbs">Pounds (lbs)</option>
                            <option value="oz">Ounces (oz)</option>
                            <option value="kg">Kilograms (kg)</option>
                            <option value="g">Grams (g)</option>
                        </select>

                        <label htmlFor="arrival_date">Arrival Date:</label>
                        <input
                            id="arrival_date"
                            name="arrival_date"
                            type="date"
                            value={formData.arrival_date}
                            onChange={handleChange}
                        />

                        <label htmlFor="breeding_status">Breeding Status:</label>
                        <select
                            id="breeding_status"
                            name="breeding_status"
                            value={formData.breeding_status}
                            onChange={handleChange}
                            required
                        >
                            <option value="Breeding">Breeding</option>
                            <option value="Not Breeding">Not Breeding</option>
                        </select>

                        <button type="submit">
                            {isEditing ? 'Update Animal Record' : 'Save Animal'}
                        </button>
                    </form>

                    {message && <p role="status">{message}</p>}
                </>
            )}
        </div>
    );
}

export default AnimalManagement;
