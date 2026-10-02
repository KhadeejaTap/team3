CREATE TABLE MEDICAL_RECORD (
  record_ID INT AUTO_INCREMENT PRIMARY KEY,
  animal_ID INT,
  date DATE,
  diagnosis VARCHAR(255),
  treatment VARCHAR(255),
  notes VARCHAR(255),
  vet_ID INT,
  follow_up DATE

  -- FOREIGN KEY(animal_ID) REFERENCES ANIMAL(animal_ID),
  -- FOREIGN KEY (vet_ID) REFERENCES EMPLOYEE(employee_ID)
);
