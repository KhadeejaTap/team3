import { useState, useEffect, useRef } from 'react';
import CardCheckoutModal from '../components/CardCheckoutModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ticketPrices = {
    Adult: 25,
    Child: 15,
};

function Tickets({ userEmail }) {
    const now = new Date();
    const minVisitDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const initialFirst = localStorage.getItem('user_first_name') || '';
    const initialLast = localStorage.getItem('user_last_name') || '';

    const [formData, setFormData] = useState({
        first_name: initialFirst,
        middle_initial: '',
        last_name: initialLast,
        ticket_type: '',
        visit_date: '',
    });

    useEffect(() => {
        const activeEmail = userEmail || localStorage.getItem('user_email') || '';
        const savedFirst = localStorage.getItem('user_first_name') || '';
        const savedLast = localStorage.getItem('user_last_name') || '';

        if (savedFirst || savedLast) {
            setFormData(prev => ({
                ...prev,
                first_name: prev.first_name || savedFirst,
                last_name: prev.last_name || savedLast,
            }));
        }

        if (activeEmail) {
            async function fetchVisitorProfile() {
                try {
                    const res = await fetch(`${API_URL}/api/user/profile?email=${encodeURIComponent(activeEmail)}`);
                    if (res.ok) {
                        const profile = await res.json();
                        setFormData(prev => ({
                            ...prev,
                            first_name: prev.first_name || profile.first_name || '',
                            last_name: prev.last_name || profile.last_name || '',
                        }));
                        if (profile.first_name) localStorage.setItem('user_first_name', profile.first_name);
                        if (profile.last_name) localStorage.setItem('user_last_name', profile.last_name);
                    }
                } catch {
                    // Ignore profile fetch error
                }
            }
            fetchVisitorProfile();
        }
    }, [userEmail]);
    const [message, setMessage] = useState('');
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const visitDateRef = useRef(null);
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

        setIsCheckoutOpen(true);
    }

    async function handleTicketCheckout({ email }) {
        const firstName = formData.first_name.trim();
        const middleInitial = formData.middle_initial.trim();
        const lastName = formData.last_name.trim();
        const visitorName = [firstName, middleInitial, lastName]
            .filter(Boolean)
            .join(' ');

        const response = await fetch(`${API_URL}/api/tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ticket_type: formData.ticket_type,
                visit_date: formData.visit_date,
                visitor_name: visitorName,
                email: email || null,
            }),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Could not purchase ticket.');
        }

        return result;
    }

    function handleTicketSuccess(result) {
        setMessage(`Ticket purchased successfully! Ticket ID: ${result.ticket_ID}`);
        setFormData({
            first_name: '',
            middle_initial: '',
            last_name: '',
            ticket_type: '',
            visit_date: '',
        });
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
                    <div className="ticket-date-input-row">
                        <input
                            ref={visitDateRef}
                            id="visit_date"
                            name="visit_date"
                            type="date"
                            required
                            min={minVisitDate}
                            value={formData.visit_date}
                            onChange={handleChange}
                        />
                        <button
                            className="ticket-date-picker-button"
                            type="button"
                            aria-label="Open visit date calendar"
                            title="Open calendar"
                            onClick={() => {
                                const dateInput = visitDateRef.current;
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

                <button type="submit">Continue to Checkout</button>
            </form>
            {message && <p role="status">{message}</p>}
            <CardCheckoutModal
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                itemType="ticket"
                items={[{
                    name: `${formData.ticket_type} Ticket - Visit ${formData.visit_date}`,
                    price,
                    quantity: 1,
                }]}
                userEmail={userEmail || localStorage.getItem('user_email') || ''}
                customCardName={`${formData.first_name} ${formData.last_name}`.trim()}
                customSubmit={handleTicketCheckout}
                onSuccess={handleTicketSuccess}
                title="Ticket Checkout"
            />
        </div>
    );
}

export default Tickets;