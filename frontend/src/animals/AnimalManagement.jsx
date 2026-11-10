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

function MedicalRecords() {
    const [animals, setAnimals] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedAnimalID, setSelectedAnimalID] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [currentImageUrl, setCurrentImageUrl] = useState('');
    const [records, setRecords] = useState([]);
    const [isSick, setIsSick] = useState(false);
    const [form, setForm] = useState({ diagnosis: '', treatment: '', notes: '', vet_ID: '', follow_up: '' });
    const [costForm, setCostForm] = useState({
        cost_category: '',
        description: '',
        amount: '',
        cost_date: ''
    });
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    async function loadAnimals() {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/medical-records/animals`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load animals.');
            setAnimals(data);
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }

    async function loadRecords(animalID) {
        if (!animalID) { setRecords([]); return; }
        try {
            const response = await fetch(`${API_URL}/api/medical-records?animal_ID=${animalID}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load medical history.');
            setRecords(data);
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
    }

    useEffect(() => { loadAnimals(); }, []);
    useEffect(() => { loadRecords(selectedAnimalID); }, [selectedAnimalID]);

    async function handleSubmit(event) {
        event.preventDefault();
        if (!selectedAnimalID) { setMessage('Please select an animal first.'); return; }
        if ((costForm.cost_category && !costForm.amount) || (!costForm.cost_category && costForm.amount)) {
            setMessage('To add a medical expense, select a cost category and enter an amount.');
            return;
        }
        if (costForm.amount && (!Number.isFinite(Number(costForm.amount)) || Number(costForm.amount) <= 0)) {
            setMessage('Medical expense amount must be greater than zero.');
            return;
        }
        setSaving(true);
        setMessage('');
        try {
            const response = await fetch(`${API_URL}/api/medical-records`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    animal_ID: Number(selectedAnimalID),
                    ...form,
                    is_sick: isSick,
                    follow_up: isSick ? null : form.follow_up
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Could not save medical record.');

            let successMessage = result.message;
            if (costForm.cost_category && costForm.amount) {
                const costResponse = await fetch(`${API_URL}/api/medical-costs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        record_ID: result.record_ID,
                        cost_category: costForm.cost_category,
                        description: costForm.description,
                        amount: Number(costForm.amount),
                        cost_date: costForm.cost_date || null
                    })
                });
                const costResult = await costResponse.json();
                if (!costResponse.ok) {
                    successMessage += ` However, the medical record was saved but its expense could not be saved: ${costResult.error || 'Unknown error.'}`;
                } else {
                    successMessage += ' Medical expense saved successfully.';
                }
            }

            setMessage(successMessage);
            setForm({ diagnosis: '', treatment: '', notes: '', vet_ID: '', follow_up: '' });
            setCostForm({ cost_category: '', description: '', amount: '', cost_date: '' });
            setIsSick(false);
            await loadRecords(selectedAnimalID);
            await loadAnimals();
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }

    const filteredAnimals = animals.filter((animal) =>
        `${animal.name} ${animal.common_name || ''} ${animal.animal_ID}`.toLowerCase().includes(search.toLowerCase())
    );
    const selectedAnimal = animals.find((animal) => String(animal.animal_ID) === String(selectedAnimalID));

    return (
        <section>
            <h1>Medical Records</h1>
            <p>Search for an animal to view its medical history or add a new record.</p>
            <label htmlFor="medicalSearch">Search animals:</label>
            <input id="medicalSearch" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, species, or ID" />
            <label htmlFor="medicalAnimal">Select Animal:</label>
            <select id="medicalAnimal" value={selectedAnimalID} onChange={(e) => setSelectedAnimalID(e.target.value)} disabled={loading}>
                <option value="">{loading ? 'Loading animals...' : 'Select an animal'}</option>
                {filteredAnimals.map((animal) => (
                    <option key={animal.animal_ID} value={animal.animal_ID}>
                        {animal.name} — {animal.common_name || 'Unknown species'} (ID: {animal.animal_ID})
                    </option>
                ))}
            </select>
            {selectedAnimal && <h2>{selectedAnimal.name} — Medical History</h2>}
            {selectedAnimalID && (records.length === 0 ? <p>No medical records found for this animal.</p> : (
                <table>
                    <thead><tr><th>Date</th><th>Diagnosis</th><th>Treatment</th><th>Notes</th><th>Sick?</th><th>Follow-up</th></tr></thead>
                    <tbody>{records.map((record) => (
                        <tr key={record.record_ID}>
                            <td>{record.date ? String(record.date).slice(0, 10) : ''}</td>
                            <td>{record.diagnosis}</td><td>{record.treatment}</td><td>{record.notes || '—'}</td>
                            <td>{record.is_sick ? 'Yes' : 'No'}</td>
                            <td>{record.follow_up ? String(record.follow_up).replace('T', ' ').slice(0, 16) : 'Not scheduled'}</td>
                        </tr>
                    ))}</tbody>
                </table>
            ))}
            <h2>Add Medical Record</h2>
            <form onSubmit={handleSubmit}>
                <label htmlFor="medicalDiagnosis">Diagnosis:</label>
                <input id="medicalDiagnosis" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} maxLength="255" required />
                <label htmlFor="medicalTreatment">Treatment:</label>
                <input id="medicalTreatment" value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} maxLength="255" required />
                <label htmlFor="medicalNotes">Notes:</label>
                <textarea id="medicalNotes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength="255" />
                <label htmlFor="medicalVet">Veterinarian Employee ID (optional):</label>
                <input id="medicalVet" type="number" min="1" value={form.vet_ID} onChange={(e) => setForm({ ...form, vet_ID: e.target.value })} />
                <h3>Medical Expense (Optional)</h3>
                <label htmlFor="medicalCostCategory">Expense Category:</label>
                <select
                    id="medicalCostCategory"
                    value={costForm.cost_category}
                    onChange={(e) => setCostForm({ ...costForm, cost_category: e.target.value })}
                >
                    <option value="">No expense to record</option>
                    <option value="Medication">Medication</option>
                    <option value="Veterinary Services">Veterinary Services</option>
                    <option value="Diagnostic Testing">Diagnostic Testing</option>
                    <option value="Medical Supplies">Medical Supplies</option>
                    <option value="Surgery/Procedures">Surgery/Procedures</option>
                    <option value="Other">Other</option>
                </select>
                <label htmlFor="medicalCostDescription">Expense Description:</label>
                <input
                    id="medicalCostDescription"
                    value={costForm.description}
                    onChange={(e) => setCostForm({ ...costForm, description: e.target.value })}
                    maxLength="255"
                    placeholder="Optional details"
                />
                <label htmlFor="medicalCostAmount">Expense Amount ($):</label>
                <input
                    id="medicalCostAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={costForm.amount}
                    onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })}
                    placeholder="0.00"
                />
                <label htmlFor="medicalCostDate">Expense Date (optional):</label>
                <input
                    id="medicalCostDate"
                    type="date"
                    value={costForm.cost_date}
                    onChange={(e) => setCostForm({ ...costForm, cost_date: e.target.value })}
                />
                <label><input type="checkbox" checked={isSick} onChange={(e) => setIsSick(e.target.checked)} /> Mark animal as sick (automatically schedule tomorrow at 9:00 AM)</label>
                {!isSick && <>
                    <label htmlFor="medicalFollowUp">Follow-up appointment (optional):</label>
                    <input id="medicalFollowUp" type="datetime-local" value={form.follow_up} onChange={(e) => setForm({ ...form, follow_up: e.target.value })} />
                </>}
                <button type="submit" disabled={saving || !selectedAnimalID}>{saving ? 'Saving...' : 'Save Medical Record'}</button>
            </form>
            {message && <p role="status">{message}</p>}
        </section>
    );
}

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
    const [isRemoving, setIsRemoving] = useState(false);
    const [removalReason, setRemovalReason] = useState('');
    const [deathReason, setDeathReason] = useState('');
    const [removalMedicalRecordID, setRemovalMedicalRecordID] = useState('');
    const [removalMedicalRecords, setRemovalMedicalRecords] = useState([]);
    const [loadingRemovalRecords, setLoadingRemovalRecords] = useState(false);
    const [animals, setAnimals] = useState([]);
    const [loadingAnimals, setLoadingAnimals] = useState(false);
    const [selectedAnimalID, setSelectedAnimalID] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [currentImageUrl, setCurrentImageUrl] = useState('');

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
        if (!isEditing && !isRemoving) return;

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
    }, [isEditing, isRemoving]);

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
        setRemovalReason('');
        setDeathReason('');
        setRemovalMedicalRecordID('');
        setRemovalMedicalRecords([]);

        if (!animalID) {
            setFormData(EMPTY_FORM);
            setSelectedImage(null);
            setImagePreview('');
            setCurrentImageUrl('');
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
        setSelectedImage(null);
        setImagePreview('');
        setCurrentImageUrl(animal.image_url || '');
        setMessage(isRemoving ? `Selected ${animal.name}. Complete the removal details below.` : `Loaded ${animal.name}. Make your changes and select Update Animal Record.`);
        if (isRemoving) {
            setLoadingRemovalRecords(true);
            fetch(`${API_URL}/api/medical-records?animal_ID=${animalID}`)
                .then(async (response) => {
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Could not load medical records.');
                    setRemovalMedicalRecords(data);
                })
                .catch((error) => setMessage(`Error: ${error.message}`))
                .finally(() => setLoadingRemovalRecords(false));
        }
    }

    function handleImageChange(event) {
        const file = event.target.files?.[0] || null;
        setSelectedImage(file);
        if (file) {
            setImagePreview(URL.createObjectURL(file));
        } else {
            setImagePreview('');
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setMessage('');

        if (isEditing && !selectedAnimalID) {
            setMessage('Please select an existing animal to update.');
            return;
        }

        const payload = new FormData();
        Object.entries({
            ...formData,
            species_ID: Number(formData.species_ID),
            enclosure_ID: Number(formData.enclosure_ID),
            age: formData.age === '' ? '' : Number(formData.age),
            weight: formData.weight === '' ? '' : Number(formData.weight)
        }).forEach(([key, value]) => payload.append(key, value ?? ''));
        if (selectedImage) payload.append('image', selectedImage);

        try {
            const response = await fetch(
                isEditing
                    ? `${API_URL}/api/animals/${selectedAnimalID}`
                    : `${API_URL}/api/animals`,
                {
                    method: isEditing ? 'PUT' : 'POST',
                    body: payload
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
                if (refreshResponse.ok) {
                    const refreshedAnimals = await refreshResponse.json();
                    setAnimals(refreshedAnimals);
                    const refreshedAnimal = refreshedAnimals.find((item) => String(item.animal_ID) === String(selectedAnimalID));
                    setCurrentImageUrl(refreshedAnimal?.image_url || currentImageUrl);
                }
            } else {
                setFormData(EMPTY_FORM);
                setSelectedImage(null);
                setImagePreview('');
                setCurrentImageUrl('');
                const imageInput = document.getElementById('animal_image');
                if (imageInput) imageInput.value = '';
            }
            setSelectedImage(null);
            setImagePreview('');
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
    }

    async function handleRemoveAnimal(event) {
        event.preventDefault();
        setMessage('');
        if (!selectedAnimalID) {
            setMessage('Please select an animal to remove.');
            return;
        }
        if (!removalReason) {
            setMessage('Please select a reason for removing this animal.');
            return;
        }
        if (removalReason === 'Death' && !deathReason.trim()) {
            setMessage('Please provide the cause or circumstances of death.');
            return;
        }
        const animal = animals.find((item) => String(item.animal_ID) === String(selectedAnimalID));
        const confirmed = window.confirm(`Remove ${animal?.name || 'this animal'} from active animal records? This action will preserve its historical record.`);
        if (!confirmed) return;
        try {
            const response = await fetch(`${API_URL}/api/animals/${selectedAnimalID}/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: removalReason,
                    death_reason: removalReason === 'Death' ? deathReason.trim() : null,
                    medical_record_ID: removalMedicalRecordID ? Number(removalMedicalRecordID) : null
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Could not remove animal.');
            setAnimals((previous) => previous.filter((item) => String(item.animal_ID) !== String(selectedAnimalID)));
            setSelectedAnimalID('');
            setFormData(EMPTY_FORM);
            setRemovalReason('');
            setDeathReason('');
            setRemovalMedicalRecordID('');
            setRemovalMedicalRecords([]);
            setSelectedImage(null);
            setImagePreview('');
            setCurrentImageUrl('');
            setMessage(result.message || 'Animal removed from active records successfully.');
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
        setIsRemoving(false);
        setSelectedAnimalID('');
        setFormData(EMPTY_FORM);
        setSelectedImage(null);
        setImagePreview('');
        setCurrentImageUrl('');
        setRemovalReason('');
        setDeathReason('');
        setRemovalMedicalRecordID('');
        setRemovalMedicalRecords([]);
        setMessage('');
    }

    function switchToRemovalMode() {
        setIsEditing(false);
        setIsRemoving(true);
        setSelectedAnimalID('');
        setFormData(EMPTY_FORM);
        setRemovalReason('');
        setDeathReason('');
        setRemovalMedicalRecordID('');
        setRemovalMedicalRecords([]);
        setSelectedImage(null);
        setImagePreview('');
        setCurrentImageUrl('');
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
                <button type="button" onClick={() => setCurrentTab('medical')}>
                    {currentTab === 'medical' ? <strong>Medical Records</strong> : 'Medical Records'}
                </button>
            </div>

            <hr />

            {currentTab === 'medical' ? (
                <MedicalRecords />
            ) : currentTab === 'report' ? (
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
                        <button type="button" onClick={switchToRemovalMode}>
                            Remove Animal
                        </button>
                    </div>

                    {(isEditing || isRemoving) && (
                        <>
                            <label htmlFor="existingAnimal">{isRemoving ? 'Select Animal to Remove:' : 'Select Animal to Update:'}</label>
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

                    {isRemoving ? (
                        <form onSubmit={handleRemoveAnimal}>
                            <h2>Remove Animal from Active Records</h2>
                            <p>The animal will be removed from active animal lists, while its existing medical history is preserved.</p>
                            <label htmlFor="removalReason">Reason for Removal:</label>
                            <select id="removalReason" value={removalReason} onChange={(e) => setRemovalReason(e.target.value)} required>
                                <option value="">Select a reason</option>
                                <option value="Death">Death</option>
                                <option value="Relocation">Relocation</option>
                                <option value="Transfer">Transfer to Another Facility</option>
                                <option value="Reintroduction">Reintroduction to the Wild</option>
                                <option value="Other">Other</option>
                            </select>
                            {removalReason === 'Death' && (
                                <>
                                    <label htmlFor="deathReason">Cause or Circumstances of Death:</label>
                                    <textarea id="deathReason" value={deathReason} onChange={(e) => setDeathReason(e.target.value)} maxLength="1000" required placeholder="Describe the reason for the animal's death" />
                                </>
                            )}
                            <label htmlFor="removalMedicalRecord">Related Medical Record ID (optional):</label>
                            <select id="removalMedicalRecord" value={removalMedicalRecordID} onChange={(e) => setRemovalMedicalRecordID(e.target.value)} disabled={!selectedAnimalID || loadingRemovalRecords}>
                                <option value="">{loadingRemovalRecords ? 'Loading medical records...' : 'No medical record selected'}</option>
                                {removalMedicalRecords.map((record) => (
                                    <option key={record.record_ID} value={record.record_ID}>
                                        Record #{record.record_ID} — {record.date ? String(record.date).slice(0, 10) : 'Undated'} — {record.diagnosis}
                                    </option>
                                ))}
                            </select>
                            <button type="submit" disabled={!selectedAnimalID}>Confirm Animal Removal</button>
                            <button type="button" onClick={() => switchMode(false)}>Cancel</button>
                        </form>
                    ) : showAddSpecies && (
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

                    {!isRemoving && <form onSubmit={handleSubmit}>
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

                        <label htmlFor="animal_image">Animal Photo:</label>
                        <input
                            id="animal_image"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleImageChange}
                        />
                        <small>Accepted formats: JPG, PNG, or WEBP. Maximum size: 5 MB.</small>
                        {(imagePreview || currentImageUrl) && (
                            <div style={{ margin: '12px 0' }}>
                                <p>{imagePreview ? 'New image preview:' : 'Current animal photo:'}</p>
                                <img
                                    src={imagePreview || `${API_URL}${currentImageUrl}`}
                                    alt="Animal preview"
                                    style={{ width: '180px', height: '140px', objectFit: 'cover', borderRadius: '8px' }}
                                />
                            </div>
                        )}

                        <button type="submit">
                            {isEditing ? 'Update Animal Record' : 'Save Animal'}
                        </button>
                    </form>}

                    {message && <p role="status">{message}</p>}
                </>
            )}
        </div>
    );
}

export default AnimalManagement;
