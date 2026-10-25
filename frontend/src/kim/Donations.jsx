import useState from "react";

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
            </form>
        </main>
    );
    }

export default Donations; 