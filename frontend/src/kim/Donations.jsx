import { useState } from "react";

function Donations() {
    return(
        <main>
            <h1>Donations</h1>
            <form>
                <label htmlFor="donor_first"> First Name</label>
                <input type="text" id="donor_first" name="donor_first" required />

                <label htmlFor="donor_last"> Last Name</label>
                <input type="text" id="donor_last" name="donor_last" required />
                
                <label htmlFor="donor_email"> Email</label>
                <input type="email" id="donor_email" name="donor_email" required />
                
                <label htmlFor="donor_phone"> Phone Number</label>
                <input type="text" id="donor_phone" name="donor_phone" required />

                <label htmlFor="donation_amt">Donation Amount ($)</label>
                <input type="number" id="donation_amt" name="donation_amt" step="0.01" min="0.01" required />

                <label htmlFor="donation_date">Donation Date</label>
                <input type="date" id="donation_date" name="donation_date" required />

                <label htmlFor="purpose">Purpose of Donation</label>
                <input type="text" id="purpose" name="purpose" required />

                <label htmlFor="payment_method">Payment Method</label>
                <select id="payment_method" name="payment_method" required>
                    <option value="credit">Credit</option>
                    <option value="debit">Debit</option>
                    <option value="digital_wallet">Digital Wallet</option>
                    <option value="paypal">PayPal</option>
                </select>

                <button type="submit">Submit Donation</button>
            </form>
        </main>
    );
    }

export default Donations; 