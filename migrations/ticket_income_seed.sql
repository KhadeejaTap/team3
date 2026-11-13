-- Seed recurring visitors and exactly 1,000 ticket purchases from January 2020
-- through November 2026. Re-running this migration does not duplicate rows.

INSERT INTO VISITOR (name, email)
WITH RECURSIVE visitor_numbers AS (
	SELECT 1 AS visitor_number
	UNION ALL
	SELECT visitor_number + 1
	FROM visitor_numbers
	WHERE visitor_number < 12
)
SELECT
	CONCAT('Ticket Seed Visitor ', LPAD(visitor_number, 2, '0')),
	CONCAT('ticket-seed-', LPAD(visitor_number, 2, '0'), '@example.com')
FROM visitor_numbers
WHERE NOT EXISTS (
	SELECT 1
	FROM VISITOR v
	WHERE v.email = CONCAT(
		'ticket-seed-',
		LPAD(visitor_numbers.visitor_number, 2, '0'),
		'@example.com'
	)
);

INSERT INTO TICKET
	(visitor_ID, ticket_type, price, purchase_date, visit_date)
WITH RECURSIVE ticket_numbers AS (
	SELECT 0 AS ticket_number
	UNION ALL
	SELECT ticket_number + 1
	FROM ticket_numbers
	WHERE ticket_number < 999
),
ticket_seed AS (
	SELECT
		ticket_number,
		CASE
			WHEN ticket_number < 996 THEN FLOOR(ticket_number / 12)
			ELSE 82
		END AS month_offset,
		CASE
			WHEN ticket_number < 996 THEN MOD(ticket_number, 12)
			ELSE 12 + (ticket_number - 996)
		END AS month_ticket_number
	FROM ticket_numbers
)
SELECT
	v.visitor_ID,
	CASE WHEN MOD(ticket_number, 12) < 8 THEN 'Adult' ELSE 'Child' END,
	CASE WHEN MOD(ticket_number, 12) < 8 THEN 25 ELSE 15 END,
	DATE_ADD(
		DATE_ADD('2020-01-01', INTERVAL month_offset MONTH),
		INTERVAL MOD(month_ticket_number, 10) DAY
	),
	DATE_ADD(
		DATE_ADD(
			DATE_ADD('2020-01-01', INTERVAL month_offset MONTH),
			INTERVAL MOD(month_ticket_number, 10) DAY
		),
		INTERVAL (7 + MOD(ticket_number, 5)) DAY
	)
FROM ticket_seed
JOIN VISITOR v
	ON v.email = CONCAT(
		'ticket-seed-',
		LPAD(MOD(ticket_number, 12) + 1, 2, '0'),
		'@example.com'
	)
WHERE NOT EXISTS (
	SELECT 1
	FROM TICKET existing
	WHERE existing.visitor_ID = v.visitor_ID
		AND existing.ticket_type =
			CASE WHEN MOD(ticket_number, 12) < 8 THEN 'Adult' ELSE 'Child' END
		AND existing.price =
			CASE WHEN MOD(ticket_number, 12) < 8 THEN 25 ELSE 15 END
		AND existing.purchase_date = DATE_ADD(
			DATE_ADD('2020-01-01', INTERVAL month_offset MONTH),
			INTERVAL MOD(month_ticket_number, 10) DAY
		)
		AND existing.visit_date = DATE_ADD(
			DATE_ADD(
				DATE_ADD('2020-01-01', INTERVAL month_offset MONTH),
				INTERVAL MOD(month_ticket_number, 10) DAY
			),
			INTERVAL (7 + MOD(ticket_number, 5)) DAY
		)
);
