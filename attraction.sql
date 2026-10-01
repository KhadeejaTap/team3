CREATE TABLE ATTRACTION (
    attr_ID INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    type VARCHAR(30),
    location VARCHAR(40),
    attr_datetime DATE,
    capacity INT,
    description VARCHAR(500)
    -- removed extra comma
);

CREATE TABLE ATTR_ANIMAL(
    attr_animal_ID INT AUTO_INCREMENT PRIMARY KEY,
    animal_ID INT NOT NULL,
    attr_ID INT NOT NULL

    -- FOREIGN KEY (animal_ID) REFERENCES ANIMAL (animal_ID),
    -- FOREIGN KEY (attr_ID) REFERENCES ATTRACTION (attr_ID)
);

CREATE TABLE ATTR_TICKET(
    attr_ticket_ID INT AUTO_INCREMENT PRIMARY KEY,
    ticket_ID INT NOT NULL, -- does this need a pk
    attr_ID INT NOT NULL

    -- FOREIGN KEY (ticket_ID) REFERENCES TICKET (ticket_ID),
    -- FOREIGN KEY (attr_ID) REFERENCES ATTRACTION (attr_ID)
);
