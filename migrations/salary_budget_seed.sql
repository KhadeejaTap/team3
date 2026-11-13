-- Seed annual salary budgets for fiscal years 2019 through 2026.
-- Re-running this migration updates these seed-year values without creating duplicates.
INSERT INTO salary_budget (fiscal_year, annual_salary_budget)
VALUES
  (2019, 1600000),
  (2020, 1628571),
  (2021, 1657143),
  (2022, 1685714),
  (2023, 1714286),
  (2024, 1742857),
  (2025, 1771429),
  (2026, 1800000)
ON DUPLICATE KEY UPDATE
  annual_salary_budget = VALUES(annual_salary_budget);
