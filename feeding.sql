CREATE TABLE FEEDING (
  feeding_ID INT AUTO_INCREMENT PRIMARY KEY,
  amount INT,
  animal_ID INT,
  feeding_time TIME,
  food_ID INT,
  employee_ID INT,

  FOREIGN KEY (animal_ID) REFERENCES ANIMAL(animal_ID),
  FOREIGN KEY (food_ID) REFERENCES FEED_ITEM(food_ID),
  FOREIGN KEY (employee_ID) REFERENCES EMPLOYEE(employee_ID)

);
