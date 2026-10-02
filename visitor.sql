CREATE TABLE VISITOR(
    visitor_ID INT AUTO_INCREMENT PRIMARY KEY, -- does this imply each visitor has only purchased one ticket? what abt repeat visitors
    name VARCHAR(100),
    age INT,
    date_of_birth date,
    email  VARCHAR(100),
    phone  VARCHAR(20),
    membership BOOLEAN DEFAULT FALSE
    -- FOREIGN KEY(ticket_ID) REFERENCES TICKET(ticket_ID)
);
