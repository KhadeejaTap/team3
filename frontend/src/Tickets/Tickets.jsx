import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ticketPrices = {
    Adult: 25,
    Child: 15,
};

function Tickets() {
    const now = new Date();
    const minVisitDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const [formData, setFormData] = useState({
        first_name: '',
        middle_initial: '',
        last_name: '',
        ticket_type: '',
        visit_date: '',
    });
    const [message, setMessage] = useState('');
    const price = ticketPrices[formData.ticket_type];

    function handleChange(event) {
        setFormData({
            ...formData,
            [event.target.name]: event.target.value,
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setMessage('');

        const firstName = formData.first_name.trim();
        const middleInitial = formData.middle_initial.trim();
        const lastName = formData.last_name.trim();
        const visitorName = [firstName, middleInitial, lastName]
            .filter(Boolean)
            .join(' ');

        if (!firstName || !lastName) {
            setMessage('Enter both a first and last name.');
            return;
        }

        if (visitorName.length > 100) {
            setMessage('The full name must be 100 characters or fewer.');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/tickets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ticket_type: formData.ticket_type,
                    visit_date: formData.visit_date,
                    visitor_name: visitorName,
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Could not purchase ticket.');
            }

            setMessage(`Ticket purchased successfully! Ticket ID: ${result.ticket_ID}`);
            setFormData({
                first_name: '',
                middle_initial: '',
                last_name: '',
                ticket_type: '',
                visit_date: '',
            });
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
    }

    return (
        <div className="ticket-purchase">
            <h1>Purchase a Ticket</h1>
            <p>Enter the ticket details below.</p>

            <form onSubmit={handleSubmit}>
                <div className="ticket-form-field">
                    <label htmlFor="ticket_type">Ticket Type:</label>
                    <select
                        id="ticket_type"
                        name="ticket_type"
                        required
                        value={formData.ticket_type}
                        onChange={handleChange}
                    >
                        <option value="">Select a ticket type</option>
                        <option value="Adult">General Adult</option>
                        <option value="Child">General Child</option>
                    </select>
                </div>

                <div className="ticket-form-field">
                    <label htmlFor="price">Price:</label>
                    <input
                        id="price"
                        type="text"
                        value={price === undefined ? '' : `$${price}`}
                        readOnly
                    />
                </div>

                <div className="ticket-form-field">
                    <label htmlFor="visit_date">Visit Date:</label>
                    <input
                        id="visit_date"
                        name="visit_date"
                        type="date"
                        required
                        min={minVisitDate}
                        value={formData.visit_date}
                        onChange={handleChange}
                    />
                </div>

                <div className="ticket-form-field">
                    <label htmlFor="first_name">First Name:</label>
                    <input
                        id="first_name"
                        name="first_name"
                        required
                        maxLength="100"
                        value={formData.first_name}
                        onChange={handleChange}
                    />
                </div>

                <div className="ticket-form-field">
                    <label htmlFor="middle_initial">Middle Initial (optional):</label>
                    <input
                        id="middle_initial"
                        name="middle_initial"
                        maxLength="1"
                        value={formData.middle_initial}
                        onChange={handleChange}
                    />
                </div>

                <div className="ticket-form-field">
                    <label htmlFor="last_name">Last Name:</label>
                    <input
                        id="last_name"
                        name="last_name"
                        required
                        maxLength="100"
                        value={formData.last_name}
                        onChange={handleChange}
                    />
                </div>

                <button type="submit">Purchase Ticket</button>
            </form>
            {message && <p role="status">{message}</p>}
        </div>
    );
}

export default Tickets;