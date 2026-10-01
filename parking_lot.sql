CREATE TABLE PARKING_LOT (
  lot_ID INT PRIMARY KEY,
  name VARCHAR(100),
  location VARCHAR(100),
  capacity INT,
  parking_rate DECIMAL(8, 2),
  department_ID INT NOT NULL

  -- FOREIGN KEY (department_ID) REFERENCES DEPARTMENT(department_ID)
);
