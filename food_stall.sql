CREATE TABLE FOOD_STALL (
  stall_ID INT PRIMARY KEY,
  name VARCHAR(100),
  location VARCHAR(100),
  opening_time TIME,
  closing_time TIME,
  department_ID INT NOT NULL,

  --FOREIGN KEY (department_ID) REFERENCES DEPARTMENT(department_ID)
);
