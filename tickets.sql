CREATE TABLE TICKET(
    ticket_ID INT AUTO_INCREMENT PRIMARY KEY,
    visitor_ID INT,
    ticket_type VARCHAR(30),
    price INT,
    purchase_date DATE,
    visit_date DATE
    -- removed extra comma
);
