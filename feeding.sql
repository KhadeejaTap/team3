CREATE TABLE FEEDING (
  feeding_ID INT PRIMARY KEY,
  amount INT,
  animal_ID INT,
  feeding_time TIME,
  food_ID INT

  FOREIGN KEY (animal ID) REFERENCES ANIMAL(animal_ID)
  FOREIGN KEY (food_ID) REFERENCES FEED_ITEM (food_ID)
);
