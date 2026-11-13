INSERT INTO ENCLOSURE_COST
(enclosure_ID, cost_category, description, amount, cost_date)
VALUES
-- Tundra (enclosure_ID 6)
(6, 'Feeding', 'Monthly food supply', 450.00, '2026-11-01'),
(6, 'Utilities', 'Heating and temperature regulation', 325.00, '2026-11-01'),
(6, 'Maintenance', 'Habitat equipment maintenance', 175.00, '2026-11-02'),
(6, 'Cleaning', 'Disinfectants and sanitation supplies', 85.00, '2026-11-03'),

-- Enclosure 1
(1, 'Feeding', 'Monthly food supply', 520.00, '2026-11-01'),
(1, 'Utilities', 'Water and electricity', 210.00, '2026-11-01'),
(1, 'Maintenance', 'Fence and habitat repairs', 140.00, '2026-11-04'),
(1, 'Cleaning', 'Cleaning and sanitation supplies', 65.00, '2026-11-03'),

-- Enclosure 2
(2, 'Feeding', 'Monthly food supply', 180.00, '2026-11-01'),
(2, 'Utilities', 'Water and electricity', 125.00, '2026-11-01'),
(2, 'Landscaping', 'Plants and habitat materials', 95.00, '2026-11-05'),

-- Enclosure 4
(4, 'Feeding', 'Monthly food supply', 275.00, '2026-11-01'),
(4, 'Utilities', 'Water filtration and electricity', 240.00, '2026-11-01'),
(4, 'Maintenance', 'Water filtration system maintenance', 190.00, '2026-11-02'),
(4, 'Cleaning', 'Aquatic habitat sanitation', 75.00, '2026-11-03'),

-- Enclosure 5
(5, 'Feeding', 'Monthly food supply', 160.00, '2026-11-01'),
(5, 'Utilities', 'Water and electricity', 110.00, '2026-11-01'),
(5, 'Maintenance', 'Habitat repairs', 90.00, '2026-11-04'),

-- Enclosure 7
(7, 'Feeding', 'Monthly food supply', 130.00, '2026-11-01'),
(7, 'Cleaning', 'Cleaning and sanitation supplies', 55.00, '2026-11-03'),
(7, 'Landscaping', 'Habitat vegetation', 80.00, '2026-11-05');


USE zoo;

INSERT INTO ENCLOSURE_COST
    (enclosure_ID, cost_category, description, amount, cost_date)

SELECT
    e.enclosure_ID,
    p.cost_category,

    CASE
        WHEN p.cost_category = 'Feeding' THEN
            CASE e.enclosure_ID
                WHEN 1 THEN 'Bulk grazing feed and animal nutrition supplies'
                WHEN 2 THEN 'Specialized bird feed and tropical fruit supplies'
                WHEN 3 THEN 'Insects and specialized reptile feed supplies'
                WHEN 4 THEN 'Fish feed and aquatic animal nutrition supplies'
                WHEN 5 THEN 'Forest habitat feed and nutritional supplies'
                WHEN 6 THEN 'Cold-climate animal feed and nutritional supplies'
                WHEN 7 THEN 'Insect colony feed and specialized food supplies'
            END

        WHEN p.cost_category = 'Utilities' THEN
            CASE e.enclosure_ID
                WHEN 1 THEN 'Watering systems and habitat electricity'
                WHEN 2 THEN 'Tropical heating and humidity regulation'
                WHEN 3 THEN 'Heat lamps and reptile temperature controls'
                WHEN 4 THEN 'Water filtration and aquatic electricity'
                WHEN 5 THEN 'Habitat lighting and water systems'
                WHEN 6 THEN 'Chilled pools and temperature-control electricity'
                WHEN 7 THEN 'Climate-controlled terrarium electricity'
            END

        WHEN p.cost_category = 'Maintenance' THEN
            CASE e.enclosure_ID
                WHEN 1 THEN 'Grazing area and shelter maintenance'
                WHEN 2 THEN 'Aviary structures and equipment repairs'
                WHEN 3 THEN 'Heat lamp and habitat equipment maintenance'
                WHEN 4 THEN 'Aquatic filtration and pool system repairs'
                WHEN 5 THEN 'Tree structures and habitat repairs'
                WHEN 6 THEN 'Cooling equipment and shelter maintenance'
                WHEN 7 THEN 'Terrarium and specialized equipment repairs'
            END

        WHEN p.cost_category = 'Cleaning' THEN
            CASE e.enclosure_ID
                WHEN 4 THEN 'Aquatic pool sanitation and filtration cleaning'
                WHEN 7 THEN 'Terrarium sanitation and cleaning supplies'
                ELSE 'Habitat sanitation and cleaning supplies'
            END

        WHEN p.cost_category = 'Landscaping' THEN
            CASE e.enclosure_ID
                WHEN 1 THEN 'Grass replacement and savanna vegetation'
                WHEN 2 THEN 'Tropical plants and aviary vegetation'
                WHEN 3 THEN 'Rock formations and habitat materials'
                WHEN 4 THEN 'Aquatic plants and habitat landscaping'
                WHEN 5 THEN 'Trees soil mulch and forest vegetation'
                WHEN 6 THEN 'Cold-climate vegetation and habitat materials'
                WHEN 7 THEN 'Terrarium plants and habitat materials'
            END
    END AS description,

    ROUND(
        (CASE
            WHEN p.cost_category = 'Feeding' THEN
                CASE e.enclosure_ID
                    WHEN 1 THEN 420
                    WHEN 2 THEN 450
                    WHEN 3 THEN 280
                    WHEN 4 THEN 400
                    WHEN 5 THEN 380
                    WHEN 6 THEN 450
                    WHEN 7 THEN 300
                END

            WHEN p.cost_category = 'Utilities' THEN
                CASE e.enclosure_ID
                    WHEN 1 THEN 220
                    WHEN 2 THEN 420
                    WHEN 3 THEN 380
                    WHEN 4 THEN 450
                    WHEN 5 THEN 200
                    WHEN 6 THEN 600
                    WHEN 7 THEN 350
                END

            WHEN p.cost_category = 'Maintenance' THEN
                CASE e.enclosure_ID
                    WHEN 1 THEN 300
                    WHEN 2 THEN 260
                    WHEN 3 THEN 280
                    WHEN 4 THEN 400
                    WHEN 5 THEN 320
                    WHEN 6 THEN 450
                    WHEN 7 THEN 220
                END

            WHEN p.cost_category = 'Cleaning' THEN
                CASE e.enclosure_ID
                    WHEN 1 THEN 150
                    WHEN 2 THEN 180
                    WHEN 3 THEN 130
                    WHEN 4 THEN 220
                    WHEN 5 THEN 160
                    WHEN 6 THEN 180
                    WHEN 7 THEN 140
                END

            WHEN p.cost_category = 'Landscaping' THEN
                CASE e.enclosure_ID
                    WHEN 1 THEN 280
                    WHEN 2 THEN 250
                    WHEN 3 THEN 120
                    WHEN 4 THEN 180
                    WHEN 5 THEN 350
                    WHEN 6 THEN 220
                    WHEN 7 THEN 100
                END
        END) * y.inflation_factor, 2
    ) AS amount,

    STR_TO_DATE(
        CONCAT(y.cost_year, '-', LPAD(p.cost_month, 2, '0'), '-15'),
        '%Y-%m-%d'
    ) AS cost_date

FROM ENCLOSURE e

CROSS JOIN (
    SELECT 2020 AS cost_year, 0.70 AS inflation_factor
    UNION ALL SELECT 2021, 0.75
    UNION ALL SELECT 2022, 0.82
    UNION ALL SELECT 2023, 0.89
    UNION ALL SELECT 2024, 0.95
    UNION ALL SELECT 2025, 1.00
) y

CROSS JOIN (
    SELECT 'Feeding' AS cost_category, 2 AS cost_month
    UNION ALL SELECT 'Utilities', 4
    UNION ALL SELECT 'Maintenance', 6
    UNION ALL SELECT 'Cleaning', 8
    UNION ALL SELECT 'Landscaping', 10
) p

WHERE NOT EXISTS (
    SELECT 1
    FROM ENCLOSURE_COST existing
    WHERE existing.enclosure_ID = e.enclosure_ID
      AND existing.cost_category = p.cost_category
      AND existing.cost_date = STR_TO_DATE(
          CONCAT(y.cost_year, '-', LPAD(p.cost_month, 2, '0'), '-15'),
          '%Y-%m-%d'
      )
);

SELECT
    YEAR(cost_date) AS expense_year,
    COUNT(*) AS expense_records,
    SUM(amount) AS total_expenses
FROM ENCLOSURE_COST
WHERE cost_date BETWEEN '2020-01-01' AND '2025-12-31'
GROUP BY YEAR(cost_date)
ORDER BY expense_year;

