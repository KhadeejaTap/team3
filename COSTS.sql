CREATE TABLE ENCLOSURE_COST (
    cost_ID INT AUTO_INCREMENT PRIMARY KEY,
    enclosure_ID INT NOT NULL,
    cost_category VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    cost_date DATE NOT NULL,

    FOREIGN KEY (enclosure_ID)
        REFERENCES ENCLOSURE(enclosure_ID)
);
