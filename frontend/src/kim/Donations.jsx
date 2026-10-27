import { useState } from "react";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000";

function Donations() {

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
                    "Content-Type": "application/json"
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
                <input type="date" id="donation_date" name="donation_date" value={donationForm.donation_date} onChange={handleChange} required />

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
        </main>
    );
    }

export default Donations; 