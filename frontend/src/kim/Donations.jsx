import { useState, useEffect } from "react";
import CardCheckoutModal from "../components/CardCheckoutModal";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000";

function Donations({ role, userEmail, userID, token }) {
    console.log("Current role:", role);
    console.log("Current userID:", userID);
    console.log("Current token:", token);

    const activeEmail = userEmail || localStorage.getItem('user_email') || "";
    const savedFirst = localStorage.getItem('user_first_name') || "";
    const savedLast = localStorage.getItem('user_last_name') || "";

    // state to hold form data
    const [donationForm, setDonationForm] = useState({
        donor_first: savedFirst, 
        donor_last: savedLast, 
        donor_email: activeEmail, 
        donor_phone: "", 
        donation_amt: "", 
        donation_date: new Date().toISOString().split("T")[0],
        purpose: "General", 
        animal_ID: "",
        payment_method: "credit"
    }); 

    const [animals, setAnimals] = useState([]);
    const [earnedCoupon, setEarnedCoupon] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    useEffect(() => {
        fetch(`${API_URL}/api/animals`)
            .then(res => res.ok ? res.json() : [])
            .then(data => setAnimals(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    // Autopopulate user name and email from profile
    useEffect(() => {
        const emailToLookup = userEmail || localStorage.getItem('user_email') || "";
        const localFirst = localStorage.getItem('user_first_name') || "";
        const localLast = localStorage.getItem('user_last_name') || "";

        if (localFirst || localLast || emailToLookup) {
            setDonationForm(prev => ({
                ...prev,
                donor_first: prev.donor_first || localFirst,
                donor_last: prev.donor_last || localLast,
                donor_email: prev.donor_email || emailToLookup,
            }));
        }

        if (emailToLookup) {
            async function fetchDonorProfile() {
                try {
                    const res = await fetch(`${API_URL}/api/user/profile?email=${encodeURIComponent(emailToLookup)}`);
                    if (res.ok) {
                        const profile = await res.json();
                        setDonationForm(prev => ({
                            ...prev,
                            donor_first: profile.first_name || prev.donor_first || "",
                            donor_last: profile.last_name || prev.donor_last || "",
                            donor_email: profile.email || prev.donor_email || emailToLookup,
                        }));
                        if (profile.first_name) localStorage.setItem('user_first_name', profile.first_name);
                        if (profile.last_name) localStorage.setItem('user_last_name', profile.last_name);
                    }
                } catch {
                    // Ignore profile fetch error
                }
            }
            fetchDonorProfile();
        }
    }, [userEmail]); 

    // history state and fetch for user's donations 
    const [donationHistory, setDonationHistory] = useState([]);
    const [historyMessage, setHistoryMessage] = useState("");
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        if (!token) {
            setDonationHistory([]);
            setHistoryMessage("");
            return;
        }

        async function loadDonationHistory() {
            setHistoryLoading(true);
            setHistoryMessage("");

            try {
                const response = await fetch(
                    `${API_URL}/api/donations/history`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.error || "Unable to load donation history."
                    );
                }

                setDonationHistory(data);
            } catch (error) {
                setHistoryMessage(error.message);
            } finally {
                setHistoryLoading(false);
            }
        }

        loadDonationHistory();
    }, [token]);

    // updating input changes to form state 
    function handleChange(event) {
        const { name, value } = event.target; 
        
        setDonationForm({
            ...donationForm, 
            [name]: value, 
        });
    }

    function handlePhoneChange(event) {
        const raw = event.target.value.replace(/\D/g, '').slice(0, 10);
        let formatted = raw;
        if (raw.length > 6) {
            formatted = `(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
        } else if (raw.length > 3) {
            formatted = `(${raw.slice(0, 3)}) ${raw.slice(3)}`;
        } else if (raw.length > 0) {
            formatted = `(${raw}`;
        }
        setDonationForm(prev => ({
            ...prev,
            donor_phone: formatted
        }));
    }

    // Open payment modal after validating donation details
    function handleSubmit(event){
        // prevent browser from refreshing the page on form submission 
        event.preventDefault();
        setMessage(""); 
        setEarnedCoupon(null);

        const phoneDigits = donationForm.donor_phone.replace(/\D/g, '');
        if (phoneDigits.length !== 10) {
            setMessage("Please enter a valid 10-digit phone number.");
            return;
        }

        const amt = Number(donationForm.donation_amt);
        if (!amt || amt <= 0) {
            setMessage("Please enter a valid donation amount.");
            return;
        }

        if (donationForm.purpose === 'Sponsor an Animal') {
            if (amt < 150) {
                setMessage("Sponsoring an animal requires a minimum donation of $150.00.");
                return;
            }
            if (!donationForm.animal_ID) {
                setMessage("Please select a specific animal to sponsor.");
                return;
            }
        }

        setShowPaymentModal(true);
    }

    async function handleProcessDonation() {
        const response = await fetch(`${API_URL}/api/donations`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                donor_first: donationForm.donor_first,
                donor_last: donationForm.donor_last,
                donor_email: donationForm.donor_email,
                donor_phone: donationForm.donor_phone,
                donation_amt: donationForm.donation_amt,
                donation_date: donationForm.donation_date,
                purpose: donationForm.purpose,
                animal_ID: donationForm.purpose === 'Sponsor an Animal' ? donationForm.animal_ID : null
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Failed to process donation.");
        }
        return data;
    }

    function handleDonationSuccess(data) {
        setMessage(data.message);
        setEarnedCoupon(data.coupon_code || null);
        if (token) {
            fetch(`${API_URL}/api/donations/history`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
            .then(res => res.ok ? res.json() : [])
            .then(history => setDonationHistory(history))
            .catch(() => {});
        }
    }

    const [message, setMessage] = useState("");




    return(
        <main className="donation-page">
            <h1>Donate</h1>
            <p>Enter your donation details below.</p>

            <form onSubmit={handleSubmit}>
                <div className="donation-form-field">
                    <label htmlFor="donor_first">First Name:</label>
                    <input type="text" id="donor_first" name="donor_first" value={donationForm.donor_first} onChange={handleChange} required />
                </div>

                <div className="donation-form-field">
                    <label htmlFor="donor_last">Last Name:</label>
                    <input type="text" id="donor_last" name="donor_last" value={donationForm.donor_last} onChange={handleChange} required />
                </div>
                
                <div className="donation-form-field">
                    <label htmlFor="donor_email">Email:</label>
                    <input type="email" id="donor_email" name="donor_email" value={donationForm.donor_email} onChange={handleChange} required />
                </div>
                
                <div className="donation-form-field">
                    <label htmlFor="donor_phone">Phone Number:</label>
                    <input
                        type="tel"
                        id="donor_phone"
                        name="donor_phone"
                        value={donationForm.donor_phone}
                        onChange={handlePhoneChange}
                        placeholder="(000) 000-0000"
                        maxLength={14}
                        required
                    />
                </div>

                <div className="donation-form-field">
                    <label htmlFor="purpose">Purpose of Donation:</label>
                    <select id="purpose" name="purpose" value={donationForm.purpose} onChange={handleChange} required>
                        <option value="General">General</option>
                        <option value="Habitat Maintenance">Habitat Maintenance</option>
                        <option value="Veterinary & Medical Care">Veterinary & Medical Care</option>
                        <option value="Sponsor an Animal">Sponsor an Animal</option>
                    </select>
                </div>

                {donationForm.purpose === 'Sponsor an Animal' && (
                    <div className="donation-form-field">
                        <label htmlFor="animal_ID">Select Animal to Sponsor:</label>
                        <select
                            id="animal_ID"
                            name="animal_ID"
                            value={donationForm.animal_ID}
                            onChange={handleChange}
                            required
                        >
                            <option value="">-- Choose an Animal --</option>
                            {animals.map((a) => (
                                <option key={a.animal_ID} value={a.animal_ID}>
                                    {a.name}{a.common_name ? ` (${a.common_name})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="donation-form-field">
                    <label htmlFor="donation_amt">
                        Donation Amount ($):
                        {donationForm.purpose === 'Sponsor an Animal' && (
                            <span style={{ fontSize: '0.85rem', marginLeft: '6px', fontWeight: 'normal' }}>
                                (Minimum $150.00 to sponsor)
                            </span>
                        )}
                    </label>
                    <input
                        type="number"
                        id="donation_amt"
                        name="donation_amt"
                        step="0.01"
                        min={donationForm.purpose === 'Sponsor an Animal' ? '150.00' : '0.01'}
                        value={donationForm.donation_amt}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="donation-form-field">
                    <label htmlFor="donation_date">Donation Date:</label>
                    <input type="date" id="donation_date" value={donationForm.donation_date} readOnly />
                </div>

                <button type="submit">Proceed to Payment</button>
                {message && <p className="donation-message" role="status">{message}</p>}
                {earnedCoupon && (
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#e8f5e9', border: '1px solid #2e7d32', borderRadius: '4px' }}>
                        <strong style={{ color: '#2e7d32' }}>Sponsor Perk: 15% Off Gift Shop Coupon!</strong>
                        <p style={{ margin: '6px 0' }}>
                            Your Coupon Code: <strong style={{ fontSize: '1.1rem', letterSpacing: '1px' }}>{earnedCoupon}</strong>
                        </p>
                        <small style={{ color: '#555' }}>
                            Type this code during checkout online or give it to the cashier in the gift shop.
                        </small>
                    </div>
                )}
            </form>

            <CardCheckoutModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                itemType="donation"
                userEmail={donationForm.donor_email}
                customCardName={`${donationForm.donor_first} ${donationForm.donor_last}`.trim()}
                directTotal={donationForm.donation_amt}
                title="Donation Checkout"
                summaryDetails={{
                    purpose: donationForm.purpose,
                    animalName: donationForm.purpose === 'Sponsor an Animal'
                        ? (animals.find(a => String(a.animal_ID) === String(donationForm.animal_ID))?.name || 'Selected Animal')
                        : null,
                    donorName: `${donationForm.donor_first} ${donationForm.donor_last}`.trim()
                }}
                customSubmit={handleProcessDonation}
                onSuccess={handleDonationSuccess}
            />
            <section className="donation-history">
                <h2>My Donation History</h2>

                {!token ? (
                    <p>Log in to view your donation history.</p>
                ) : historyLoading ? (
                    <p>Loading donation history...</p>
                ) : historyMessage ? (
                    <p>{historyMessage}</p>
                ) : donationHistory.length === 0 ? (
                    <p>You haven't made any linked donations yet.</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Amount</th>
                                <th>Purpose</th>
                                <th>Payment Method</th>
                            </tr>
                        </thead>
                        <tbody>
                            {donationHistory.map((donation) => (
                                <tr key={donation.donation_ID}>
                                    <td>
                                        {String(donation.donation_date).slice(0, 10)}
                                    </td>
                                    <td>
                                        ${Number(donation.amount).toFixed(2)}
                                    </td>
                                    <td>{donation.purpose}{donation.animal_name ? ` (${donation.animal_name})` : ''}</td>
                                    <td>{donation.payment_method}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </main>
    );
    }

export default Donations; 