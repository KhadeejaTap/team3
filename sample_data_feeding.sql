INSERT INTO FEED_ITEM
    (food_name, food_category, supplier, quantity)
VALUES
    ('Beef', 'Meat', 'Wildlife Nutrition Supply', 200),
    ('Fish', 'Seafood', 'Gulf Coast Seafood', 150),
    ('Leafy Greens', 'Vegetables', 'Fresh Farm Produce', 100),
    ('Fruit Mix', 'Fruit', 'Tropical Produce Co.', 80),
    ('Bamboo', 'Plant', 'Bamboo Grove Supply', 120),
    ('Crickets', 'Live Feed', 'Exotic Feeder Supply', 500),
    ('Mealworms', 'Live Feed', 'Exotic Feeder Supply', 300),
    ('Zoo Pellets', 'Commercial Feed', 'Zoo Nutrition Co.', 100),
    ('Aquatic Plants', 'Plant', 'Aquatic Feed Supply', 60),
    ('Shrimp', 'Seafood', 'Gulf Coast Seafood', 75);

INSERT INTO FEEDING
    (amount, animal_ID, feeding_time, food_ID, employee_ID)
VALUES
    (5000, 1, '08:00:00', 2, 2),  -- Snowbell
    (8000, 2, '09:00:00', 1, 6),  -- Jake
    (200, 3, '10:00:00', 3, 7),   -- Fancy
    (3000, 4, '11:00:00', 1, 8),  -- Jaggy
    (1000, 5, '08:30:00', 2, 9),  -- Longlong
    (100, 6, '09:30:00', 4, 10),  -- Fruit Loops
    (1000, 8, '10:30:00', 3, 3),  -- Zuri
    (5, 9, '11:30:00', 6, 11),    -- Kyle
    (10, 10, '12:00:00', 6, 12),  -- Cobalt
    (50, 11, '12:30:00', 2, 4),   -- Rosa
    (2000, 12, '13:00:00', 2, 5); -- Crush
