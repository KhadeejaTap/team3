CREATE TABLE ENCLOSURE (
  enclosure_ID INT PRIMARY KEY,
  name VARCHAR(100),
  location VARCHAR(100),
  capacity INT,
  indoor_outdoor VARCHAR(20),
  size INT,
  department_ID INT NOT NULL -- fk to managing dept in dept table
);
