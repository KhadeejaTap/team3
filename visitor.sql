CREATE TABLE VISITOR(
    visitor_ID INT PRIMARY KEY,
    ticket_ID INT NOT NULL,
    name VARCHAR(100),
    age INT,
    email  VARCHAR(100),
    phone  VARCHAR(20),
    membership BOOLEAN DEFAULT FALSE,
    

    FOREIGN KEY(ticket_ID) REFERENCES TICKET(ticket_ID)
);
   
