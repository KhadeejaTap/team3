import { useState } from 'react';

const ticketPrices = {
    Adult: 25,
    Child: 15,
};

function Tickets() {
    const now = new Date();
    const minVisitDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const [formData, setFormData] = useState({
        visitor_name: '',
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

        try {
            const response = await fetch('http://localhost:5000/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    visitor_name: formData.visitor_name.trim() || null,
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Could not purchase ticket.');
            }

            setMessage(`Ticket purchased successfully! Ticket ID: ${result.ticket_ID}`);
            setFormData({
                visitor_name: '',
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
                    <label htmlFor="visitor_name">Visitor Name (optional):</label>
                    <input
                        id="visitor_name"
                        name="visitor_name"
                        maxLength="100"
                        value={formData.visitor_name}
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