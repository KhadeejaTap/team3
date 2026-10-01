CREATE TABLE FEEDING (
  feeding_ID INT PRIMARY KEY,
  amount INT,
  feeding_time TIME,
  food_ID INT,

  --FOREIGN KEY (food_ID) REFERENCES FEED_ITEM (food_ID)
); -- maybe add animal being fed and employee responsible?
