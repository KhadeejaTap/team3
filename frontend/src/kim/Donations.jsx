import { useState, useEffect } from "react";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000";

function Donations({ role, userEmail, userID, token }) {
    console.log("Current role:", role);
    console.log("Current userID:", userID);
    console.log("Current token:", token);

    // state to hold form data
    const [donationForm, setDonationForm] = useState({
        donor_first: "", 
        donor_last: "", 
        donor_email: "", 
        donor_phone: "", 
        donation_amt: "", 
        donation_date: new Date().toISOString().split("T")[0],
        purpose: "", 
        payment_method: "credit"
    }); 

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

    // handling form submission 
    async function handleSubmit(event){
        // prevent browser from refreshing the page on form submission 
        event.preventDefault();
        setMessage(""); 

        try{
            // sends data to backend 
            const response = await fetch(`${API_URL}/api/donations`, {
                method: "POST", 
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(donationForm)
            }); 

            // reads backend response 
            const data = await response.json(); 

            // did backend succeed? 
            if(!response.ok){
                throw new Error(data.error || "Failed to save donation."); 
            } 

            setMessage(data.message); 
            if (token) {
                const historyResponse = await fetch(
                    `${API_URL}/api/donations/history`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (historyResponse.ok) {
                    const historyData = await historyResponse.json();
                    setDonationHistory(historyData);
                }
            }
            console.log("Donation saved:", data); 
        } catch (error){
            console.error("Donation submission error:", error);
            setMessage(error.message || "Unable to save donation. Please try again."); 
        }
    }

    const [message, setMessage] = useState("");




    return(
        <main>
            <h1>Donations</h1>
            <form onSubmit={handleSubmit}>
                <label htmlFor="donor_first"> First Name</label>
                <input type="text" id="donor_first" name="donor_first" value={donationForm.donor_first} onChange={handleChange} required />

                <label htmlFor="donor_last"> Last Name</label>
                <input type="text" id="donor_last" name="donor_last" value={donationForm.donor_last} onChange={handleChange} required />
                
                <label htmlFor="donor_email"> Email</label>
                <input type="email" id="donor_email" name="donor_email" value={donationForm.donor_email} onChange={handleChange} required />
                
                <label htmlFor="donor_phone"> Phone Number</label>
                <input type="text" id="donor_phone" name="donor_phone" value={donationForm.donor_phone} onChange={handleChange} required />

                <label htmlFor="donation_amt">Donation Amount ($)</label>
                <input type="number" id="donation_amt" name="donation_amt" step="0.01" min="0.01" value={donationForm.donation_amt} onChange={handleChange} required />

                <label htmlFor="donation_date">Donation Date</label>
                <input type="date" value={donationForm.donation_date} readOnly/>

                <label htmlFor="purpose">Purpose of Donation</label>
                <input type="text" id="purpose" name="purpose" value={donationForm.purpose} onChange={handleChange} required />

                <label htmlFor="payment_method">Payment Method</label>
                <select id="payment_method" name="payment_method" value={donationForm.payment_method} onChange={handleChange} required>
                    <option value="credit">Credit</option>
                    <option value="debit">Debit</option>
                    <option value="digital_wallet">Digital Wallet</option>
                    <option value="paypal">PayPal</option>
                </select>

                <button type="submit">Submit Donation</button>
                {message && <p role="status">{message}</p>}
            </form>
            <section>
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
                                    <td>{donation.purpose}</td>
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