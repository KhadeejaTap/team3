CREATE TABLE ANIMAL (
  animal_ID INT AUTO_INCREMENT PRIMARY KEY,
  species_ID INT NOT NULL,
  enclosure_ID INT NOT NULL,
  name VARCHAR(100),
  age INT,
  gender VARCHAR(20),
  weight DECIMAL (6, 2),
  arrival_date DATE,
  breeding_status VARCHAR(50),

);
