CREATE TABLE TRANSACTION_ITEM (
    transaction_item_ID  INT AUTO_INCREMENT PRIMARY KEY,
    transaction_ID  INT, -- this will be a FK referencing the CUST_TRANSACTION table
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('food', 'product', 'ticket', 'parking', 'donation')),
    item_ID  INT NOT NULL,
    quantity   INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    price  DECIMAL(10,2) NOT NULL CHECK(price >= 0)
);
