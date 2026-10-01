CREATE TABLE VISITOR(
    visitor_ID INT PRIMARY KEY, -- does this imply each visitor has only purchased one ticket? what abt repeat visitors
    ticket_ID INT NOT NULL,
    name VARCHAR(100),
    age INT,
    email  VARCHAR(100),
    phone  VARCHAR(20),
    membership BOOLEAN DEFAULT FALSE


    -- FOREIGN KEY(ticket_ID) REFERENCES TICKET(ticket_ID)
);
