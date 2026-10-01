CREATE TABLE DONATION (
    donation_ID  INT AUTO_INCREMENT PRIMARY KEY,
    donor_ID  INT NOT NULL, -- this will be a foreign key referencing the VISITOR table
    amount  DECIMAL(10,2) NOT NULL CHECK(amount >= 0), 
    donation_date  DATE NOT NULL,
    purpose VARCHAR(225) NOT NULL
);