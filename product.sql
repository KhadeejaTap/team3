CREATE TABLE PRODUCT (
product_ID INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  category VARCHAR(50),
  price DECIMAL(8, 2),
  quantity_in_stock INT,
  color VARCHAR(50),
  design VARCHAR(100),
  shop_ID INT NOT NULL

  -- FOREIGN KEY (shop_ID) REFERENCES GIFT_SHOP(shop_ID)
);
