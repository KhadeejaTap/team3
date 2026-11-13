const { requireRoles } = require('../auth');

async function requireFinanceHead(req, res, pool, send) {
	if (!(await requireRoles(req, res, pool, send, ['manager']))) {
		return false;
	}

	const [departmentHeads] = await pool.query(
		`SELECT e.employee_ID
     FROM EMPLOYEE e
     JOIN DEPARTMENT d ON d.department_ID = e.department_ID
     WHERE e.email = ?
       AND e.department_ID = 1
       AND e.employee_ID = d.head_employee_ID`,
		[req.user.email]
	);

	if (departmentHeads.length === 0) {
		send(res, 403, {
			error: 'Only the Financial & HR department head can manage the salary budget.'
		});
		return false;
	}

	return true;
}

async function requireFinanceStaff(req, res, pool, send) {
	if (!(await requireRoles(req, res, pool, send, ['manager', 'employee']))) {
		return false;
	}

	const [financeStaff] = await pool.query(
		`SELECT e.employee_ID
     FROM EMPLOYEE e
     WHERE e.email = ?
       AND e.department_ID = 1`,
		[req.user.email]
	);

	if (financeStaff.length === 0) {
		send(res, 403, {
			error: 'Only Financial & HR staff can view payroll.'
		});
		return false;
	}

	return true;
}

function buildReportDateClause(columnName, timeFrame, startDate, endDate) {
	if (timeFrame === 'yearToDate') {
		return {
			conditions: [
				`${columnName} >= MAKEDATE(YEAR(CURDATE()), 1)`,
				`${columnName} <= CURDATE()`
			],
			params: []
		};
	}
	if (timeFrame === 'customDateFrame') {
		if (
			!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') ||
			!/^\d{4}-\d{2}-\d{2}$/.test(endDate || '') ||
			startDate > endDate
		) {
			return { error: 'A valid custom start and end date are required.' };
		}
		return {
			conditions: [`${columnName} BETWEEN ? AND ?`],
			params: [startDate, endDate]
		};
	}
	if (timeFrame === 'allTime') {
		return { conditions: [], params: [] };
	}
	return { error: 'Invalid report timeframe.' };
}

async function handleFinance(req, res, pool, send, readBody) {
	const parsedUrl = new URL(req.url, 'http://localhost');
	const pathname = parsedUrl.pathname;

	if (pathname === '/api/salary-budget/latest' && req.method === 'GET') {
		if (!(await requireFinanceHead(req, res, pool, send))) {
			return true;
		}

		const [[latest]] = await pool.query(
			`SELECT annual_salary_budget
       FROM salary_budget
       ORDER BY fiscal_year DESC
       LIMIT 1`
		);
		send(res, 200, {
			latestBudget: latest?.annual_salary_budget ?? 450000
		});
		return true;
	}

	if (pathname === '/api/salary-budget' && req.method === 'POST') {
		if (!(await requireFinanceHead(req, res, pool, send))) {
			return true;
		}

		const data = await readBody(req);
		const nextFiscalYear = new Date().getFullYear() + 1;
		const budget =
			data.annual_salary_budget === null ||
				data.annual_salary_budget === undefined ||
				data.annual_salary_budget === ''
				? null
				: Number(data.annual_salary_budget);

		if (
			Number(data.fiscal_year) !== nextFiscalYear ||
			(budget !== null && (!Number.isSafeInteger(budget) || budget < 0))
		) {
			send(res, 400, {
				error: `Only a nonnegative whole-dollar budget for FY ${nextFiscalYear} is allowed.`
			});
			return true;
		}

		await pool.query(
			`INSERT INTO salary_budget (fiscal_year, annual_salary_budget)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE annual_salary_budget = COALESCE(VALUES(annual_salary_budget), annual_salary_budget)`,
			[nextFiscalYear, budget]
		);

		const [[savedBudget]] = await pool.query(
			'SELECT fiscal_year, annual_salary_budget FROM salary_budget WHERE fiscal_year = ?',
			[nextFiscalYear]
		);
		send(res, 200, savedBudget);
		return true;
	}

	const paycheckMatch = pathname.match(/^\/api\/paychecks\/(\d+)$/);
	if (paycheckMatch && req.method === 'GET') {
		if (!(await requireFinanceStaff(req, res, pool, send))) {
			return true;
		}

		const startDate = parsedUrl.searchParams.get('startDate');
		const endDate = parsedUrl.searchParams.get('endDate');

		if (
			!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') ||
			!/^\d{4}-\d{2}-\d{2}$/.test(endDate || '') ||
			startDate > endDate
		) {
			send(res, 400, { error: 'A valid start and end date are required.' });
			return true;
		}

		const [rows] = await pool.query(
			`SELECT paycheck_ID, pay_period_start, pay_period_end,
			        gross_pay, federal_tax, fica_tax,
			        benefits_deduction, net_pay
			   FROM PAYCHECK
			  WHERE employee_ID = ?
			    AND pay_period_start <= ?
			    AND pay_period_end >= ?
			  ORDER BY pay_period_start`,
			[paycheckMatch[1], endDate, startDate]
		);

		send(res, 200, rows);
		return true;
	}

	if (pathname === '/api/profit-report' && req.method === 'GET') {
		if (!(await requireFinanceStaff(req, res, pool, send))) {
			return true;
		}

		const stream = parsedUrl.searchParams.get('stream');
		const reportType = parsedUrl.searchParams.get('reportType') || 'revenue';
		const timeFrame = parsedUrl.searchParams.get('timeFrame') || 'yearToDate';
		const startDate = parsedUrl.searchParams.get('startDate');
		const endDate = parsedUrl.searchParams.get('endDate');
		const sortBy = parsedUrl.searchParams.get('sortBy') || (stream === 'food' ? 'salePrice' : 'date');
		const stallId = parsedUrl.searchParams.get('stallId') || 'all';

		if (!['food', 'tickets', 'donations', 'giftShop'].includes(stream)) {
			send(res, 400, {
				error: 'Only food, ticket, giftshop, and donation reports are currently supported.'
			});
			return true;
		}
		if (stallId !== 'all' && !/^\d+$/.test(stallId)) {
			send(res, 400, { error: 'Invalid food stall filter.' });
			return true;
		}

		if (stream === 'tickets') {
			const dateFilter = buildReportDateClause('t.purchase_date', timeFrame, startDate, endDate);
			if (dateFilter.error) {
				send(res, 400, { error: dateFilter.error });
				return true;
			}

			const ticketWhereClause = dateFilter.conditions.length
				? `WHERE ${dateFilter.conditions.join(' AND ')}`
				: '';
			const ticketSortClause = sortBy === 'amount'
				? 'ORDER BY t.price DESC, t.purchase_date DESC, t.ticket_ID DESC'
				: 'ORDER BY t.purchase_date DESC, t.ticket_ID DESC';

			const [ticketRows] = await pool.query(
				`SELECT
					t.ticket_ID,
					t.purchase_date,
					t.visit_date,
					t.ticket_type,
					t.price AS report_amount,
					COALESCE(NULLIF(TRIM(v.name), ''), 'name not recorded') AS visitor_name,
					COALESCE(NULLIF(TRIM(v.email), ''), 'email not recorded') AS visitor_email
				FROM TICKET t
				LEFT JOIN VISITOR v ON t.visitor_ID = v.visitor_ID
				${ticketWhereClause}
				${ticketSortClause}`,
				dateFilter.params
			);
			const [[ticketTotals]] = await pool.query(
				`SELECT
					COUNT(*) AS ticket_count,
					COALESCE(SUM(t.price), 0) AS revenue
				FROM TICKET t
				${ticketWhereClause}`,
				dateFilter.params
			);
			const [ticketTypeSummary] = await pool.query(
				`SELECT
					t.ticket_type,
					COUNT(*) AS ticket_count,
					COALESCE(SUM(t.price), 0) AS revenue
				FROM TICKET t
				${ticketWhereClause}
				GROUP BY t.ticket_type
				ORDER BY revenue DESC`,
				dateFilter.params
			);

			send(res, 200, {
				ticketRows,
				ticketTotals,
				ticketTypeSummary
			});
			return true;
		}

		if (stream === 'donations') {
			const dateFilter = buildReportDateClause('d.donation_date', timeFrame, startDate, endDate);
			if (dateFilter.error) {
				send(res, 400, { error: dateFilter.error });
				return true;
			}

			const donationWhereClause = dateFilter.conditions.length
				? `WHERE ${dateFilter.conditions.join(' AND ')}`
				: '';
			const donationSortClause = sortBy === 'amount'
				? 'ORDER BY d.amount DESC, d.donation_date DESC, d.donation_ID DESC'
				: 'ORDER BY d.donation_date DESC, d.amount DESC, d.donation_ID DESC';

			const [donationRows] = await pool.query(
				`SELECT
					d.donation_ID,
					d.donor_ID,
					COALESCE(NULLIF(TRIM(dn.first_name), ''), 'name not recorded') AS first_name,
					COALESCE(NULLIF(TRIM(dn.last_name), ''), '') AS last_name,
					COALESCE(NULLIF(TRIM(dn.donor_email), ''), 'email not recorded') AS donor_email,
					COALESCE(NULLIF(TRIM(dn.donor_phone), ''), 'phone not recorded') AS donor_phone,
					d.amount,
					d.donation_date,
					d.purpose
				FROM donation d
				LEFT JOIN donor dn ON d.donor_ID = dn.donor_ID
				${donationWhereClause}
				${donationSortClause}`,
				dateFilter.params
			);

			let totalRevenue = 0;
			const purposeTotalsMap = {};
			const donorMap = new Map();

			for (const row of donationRows) {
				const amt = Number(row.amount || 0);
				totalRevenue += amt;
				purposeTotalsMap[row.purpose] = (purposeTotalsMap[row.purpose] || 0) + amt;

				const donorKey = row.donor_ID || `${row.first_name}_${row.last_name}`;
				if (!donorMap.has(donorKey)) {
					donorMap.set(donorKey, {
						donor_ID: row.donor_ID,
						first_name: row.first_name,
						last_name: row.last_name,
						donor_email: row.donor_email,
						donor_phone: row.donor_phone,
						total_amount: 0,
						donation_count: 0,
						purposes: {},
						latest_date: row.donation_date
					});
				}
				const donor = donorMap.get(donorKey);
				donor.total_amount += amt;
				donor.donation_count += 1;
				donor.purposes[row.purpose] = (donor.purposes[row.purpose] || 0) + amt;
				if (!donor.latest_date || new Date(row.donation_date) > new Date(donor.latest_date)) {
					donor.latest_date = row.donation_date;
				}
			}

			const donorSummary = Array.from(donorMap.values())
				.filter((donor) => donor.donation_count > 1)
				.map((donor) => ({
					...donor,
					purpose_breakdown: Object.entries(donor.purposes)
						.map(([purpose, amount]) => `${purpose}: $${Number(amount).toFixed(2)}`)
						.join(', ')
				}))
				.sort((a, b) =>
					sortBy === 'date'
						? new Date(b.latest_date) - new Date(a.latest_date)
						: b.total_amount - a.total_amount
				);

			const donationPurposeSummary = Object.entries(purposeTotalsMap).map(
				([purpose, total]) => ({
					purpose,
					total_amount: total
				})
			);

			const donorSummaryPurposeTotalsMap = {};
			let donorSummaryRevenue = 0;
			let donorSummaryDonationCount = 0;

			for (const donor of donorSummary) {
				donorSummaryRevenue += donor.total_amount;
				donorSummaryDonationCount += donor.donation_count;
				for (const [purpose, amount] of Object.entries(donor.purposes)) {
					donorSummaryPurposeTotalsMap[purpose] =
						(donorSummaryPurposeTotalsMap[purpose] || 0) + amount;
				}
			}

			const donorSummaryPurposeSummary = Object.entries(donorSummaryPurposeTotalsMap).map(
				([purpose, total]) => ({
					purpose,
					total_amount: total
				})
			);

			send(res, 200, {
				donationRows,
				donorSummary,
				donationTotals: {
					donation_count: donationRows.length,
					revenue: totalRevenue
				},
				donationPurposeSummary,
				donorSummaryTotals: {
					donor_count: donorSummary.length,
					donation_count: donorSummaryDonationCount,
					revenue: donorSummaryRevenue
				},
				donorSummaryPurposeSummary
			});
			return true;
		}

		if (stream === 'giftShop') {
			const dateFilter = buildReportDateClause('ct.transaction_date', timeFrame, startDate, endDate);
			if (dateFilter.error) {
				send(res, 400, { error: dateFilter.error });
				return true;
			}
			const whereConditions = ["ti.item_type = 'product'", ...dateFilter.conditions];
			const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

			const reportAmount = reportType === 'profit'
				? '(ti.quantity * (ti.price - p.cost_price))'
				: '(ti.quantity * ti.price)';

			const sortClause = sortBy === 'amount'
				? `ORDER BY report_amount DESC, ct.transaction_date DESC`
				: `ORDER BY ct.transaction_date DESC, report_amount DESC`;

			// 4. Detailed Sales Log Query
			const [rows] = await pool.query(
				`SELECT
                ct.transaction_ID,
                ct.transaction_date,
                COALESCE(NULLIF(TRIM(v.name), ''), 'Customer not recorded') AS customer_name,
                p.product_ID,
                p.name AS item_name,
                p.category,
                ti.quantity,
                ti.price AS sale_price,
                p.cost_price,
                (ti.quantity * ti.price) AS sale_total,
                (ti.quantity * p.cost_price) AS expense_total,
                CASE
                  WHEN c.coupon_ID IS NOT NULL
                  THEN ti.quantity * ti.price * (1 - c.discount_percent / 100)
                  ELSE ti.quantity * ti.price
                END AS price_paid_after_coupon,
                CASE
                  WHEN c.coupon_ID IS NOT NULL
                  THEN ti.quantity * ti.price * (1 - c.discount_percent / 100) - (ti.quantity * p.cost_price)
                  ELSE ti.quantity * (ti.price - p.cost_price)
                END AS profit_total,
                COALESCE(c.code, '') AS coupon_code,
                ${reportAmount} AS report_amount
             FROM TRANSACTION_ITEM ti
             JOIN CUST_TRANSACTION ct ON ct.transaction_ID = ti.transaction_ID
             LEFT JOIN VISITOR v ON v.visitor_ID = ct.visitor_ID
             JOIN PRODUCT p ON p.product_ID = ti.item_ID
             LEFT JOIN COUPON c ON c.transaction_ID = ct.transaction_ID
             ${whereClause}
             ${sortClause}`,
				dateFilter.params
			);

			const [itemSummary] = await pool.query(
				`SELECT
                p.product_ID AS item_ID,
                p.name AS item_name,
                p.category,
                SUM(ti.quantity) AS quantity_sold,
                COUNT(*) AS sale_count,
                SUM(ti.quantity * ti.price) AS sale_total,
                SUM(ti.quantity * p.cost_price) AS expense_total,
                SUM(
                  CASE
                    WHEN c.coupon_ID IS NOT NULL
                    THEN ti.quantity * ti.price * (1 - c.discount_percent / 100)
                    ELSE ti.quantity * ti.price
                  END
                ) AS price_paid_after_coupon,
                SUM(
                  CASE
                    WHEN c.coupon_ID IS NOT NULL
                    THEN ti.quantity * ti.price * (1 - c.discount_percent / 100) - (ti.quantity * p.cost_price)
                    ELSE ti.quantity * (ti.price - p.cost_price)
                  END
                ) AS profit_total,
                SUM(
                  CASE
                    WHEN c.coupon_ID IS NOT NULL
                    THEN ti.quantity * ti.price * (1 - c.discount_percent / 100)
                    ELSE ti.quantity * ti.price
                  END
                ) - SUM(ti.quantity * p.cost_price) AS profit_with_discount,
                SUM(${reportAmount}) AS report_amount
             FROM TRANSACTION_ITEM ti
             JOIN CUST_TRANSACTION ct ON ct.transaction_ID = ti.transaction_ID
             JOIN PRODUCT p ON p.product_ID = ti.item_ID
             LEFT JOIN COUPON c ON c.transaction_ID = ct.transaction_ID
             ${whereClause}
             GROUP BY p.product_ID, p.name, p.category
             ORDER BY report_amount DESC, p.name`,
				dateFilter.params
			);

			send(res, 200, { rows, itemSummary });
			return true;
		}
	const dateFilter = buildReportDateClause('ct.transaction_date', timeFrame, startDate, endDate);
	if (dateFilter.error) {
		send(res, 400, { error: dateFilter.error });
		return true;
	}
	const dateConditions = dateFilter.conditions;
	const dateParams = dateFilter.params;

	const sortColumn = sortBy === 'largestSale'
		? '(ti.quantity * ti.price)'
		: 'ti.price';
	const reportAmount = {
		revenue: '(ti.quantity * ti.price)',
		expenses: '(ti.quantity * mi.cost_to_make)',
		profit: '(ti.quantity * (ti.price - mi.cost_to_make))'
	}[reportType];
	const whereClause = [
		"ti.item_type = 'food'",
		...(stallId === 'all' ? [] : ['fs.stall_ID = ?']),
		...dateConditions
	].join(' AND ');
	const queryParams = stallId === 'all'
		? dateParams
		: [stallId, ...dateParams];

	const [rows] = await pool.query(
		`SELECT
				ct.transaction_ID,
				ct.transaction_date,
				COALESCE(NULLIF(v.name, ''), 'Customer not recorded') AS customer_name,
				mi.item_ID,
				mi.name AS item_name,
				fs.name AS stall_name,
				ti.quantity,
				ti.price AS sale_price,
				(ti.quantity * ti.price) AS sale_total,
				(ti.quantity * mi.cost_to_make) AS expense_total,
				(ti.quantity * (ti.price - mi.cost_to_make)) AS profit_total,
				${reportAmount} AS report_amount
			 FROM TRANSACTION_ITEM ti
			 JOIN CUST_TRANSACTION ct ON ct.transaction_ID = ti.transaction_ID
			 LEFT JOIN VISITOR v ON v.visitor_ID = ct.visitor_ID
			 JOIN MENU_ITEM mi ON mi.item_ID = ti.item_ID
			 JOIN FOOD_STALL fs ON fs.stall_ID = mi.stall_ID
			 WHERE ${whereClause}
			 ORDER BY ${sortColumn} DESC, ct.transaction_date DESC, ti.transaction_item_ID DESC`,
		queryParams
	);

	const [itemSummary] = await pool.query(
		`SELECT
				mi.item_ID,
				mi.name AS item_name,
				SUM(ti.quantity) AS quantity_sold,
				COUNT(*) AS sale_count,
				SUM(ti.quantity * ti.price) AS sale_total,
				SUM(ti.quantity * mi.cost_to_make) AS expense_total,
				SUM(ti.quantity * (ti.price - mi.cost_to_make)) AS profit_total,
				SUM(${reportAmount}) AS report_amount
			 FROM TRANSACTION_ITEM ti
			 JOIN CUST_TRANSACTION ct ON ct.transaction_ID = ti.transaction_ID
			 JOIN MENU_ITEM mi ON mi.item_ID = ti.item_ID
			 JOIN FOOD_STALL fs ON fs.stall_ID = mi.stall_ID
			 WHERE ${whereClause}
			 GROUP BY mi.item_ID, mi.name
			 ORDER BY report_amount DESC, mi.name`,
		queryParams
	);
	send(res, 200, { rows, itemSummary });
	return true;
}

if (pathname === '/api/payroll' && req.method === 'GET') {
	if (!(await requireFinanceStaff(req, res, pool, send))) {
		return true;
	}

	const department = parsedUrl.searchParams.get('department') || 'all';
	const timeFrame = parsedUrl.searchParams.get('timeFrame') || 'yearToDate';
	const startDate = parsedUrl.searchParams.get('startDate');
	const endDate = parsedUrl.searchParams.get('endDate');
	const staffType = parsedUrl.searchParams.get('staffType') || 'all';
	const sex = parsedUrl.searchParams.get('sex') || 'all';
	const sortBy = parsedUrl.searchParams.get('sortBy') || 'yearlySalary';
	const sortDirection =
		parsedUrl.searchParams.get('sortDirection') === 'descending'
			? 'DESC'
			: 'ASC';

	const employeeConditions = ['e.current = 1'];
	const employeeParams = [];
	const paycheckConditions = [];
	const paycheckParams = [];

	if (department !== 'all') {
		employeeConditions.push('d.department_name = ?');
		employeeParams.push(department);
	}

	if (staffType === 'fullTime') {
		employeeConditions.push('e.hours >= 35');
	} else if (staffType === 'partTime') {
		employeeConditions.push('e.hours < 35');
	}

	if (sex === 'female' || sex === 'male') {
		employeeConditions.push('e.sex = ?');
		employeeParams.push(sex === 'female' ? 'F' : 'M');
	} else if (sex !== 'all') {
		send(res, 400, { error: 'Invalid sex filter.' });
		return true;
	}

	if (timeFrame === 'yearToDate') {
		paycheckConditions.push(`
				p.pay_period_start <= CURDATE()
				AND p.pay_period_end >= MAKEDATE(YEAR(CURDATE()), 1)
			`);
	} else if (timeFrame === 'customDateFrame') {
		if (
			!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') ||
			!/^\d{4}-\d{2}-\d{2}$/.test(endDate || '') ||
			startDate > endDate
		) {
			send(res, 400, {
				error: 'A valid custom start and end date are required.'
			});
			return true;
		}

		paycheckConditions.push(`
				p.pay_period_start <= ?
				AND p.pay_period_end >= ?
			`);
		paycheckParams.push(endDate, startDate);
	} else if (timeFrame !== 'allTime') {
		send(res, 400, { error: 'Invalid payroll time frame.' });
		return true;
	}

	const sortColumns = {
		yearlySalary: 'e.salary',
		tenure: 'tenure_weeks',
		employeeName: 'employee_name'
	};
	const sortColumn = sortColumns[sortBy] || sortColumns.yearlySalary;

	const [rows] = await pool.query(
		`WITH active_history AS (
         SELECT employee_ID, MAX(start_date) AS start_date
         FROM EMPLOYMENT_HISTORY
         WHERE status = 'active'
         GROUP BY employee_ID
       ),
       payroll_totals AS (
         SELECT p.employee_ID,
                SUM(p.gross_pay) AS gross_pay
         FROM PAYCHECK p
         ${paycheckConditions.length ? `WHERE ${paycheckConditions.join(' AND ')}` : ''}
         GROUP BY p.employee_ID
       ),
       current_year_totals AS (
         SELECT p.employee_ID,
                SUM(p.gross_pay) AS gross_pay
         FROM PAYCHECK p
         WHERE p.pay_period_end >= MAKEDATE(YEAR(CURDATE()), 1)
           AND p.pay_period_end <= CURDATE()
         GROUP BY p.employee_ID
       )
       SELECT
         e.employee_ID,
         CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
         e.sex,
         d.department_ID AS department_id,
         d.department_name,
         CASE WHEN d.head_employee_ID = e.employee_ID THEN 1 ELSE 0 END AS is_department_head,
         e.role,
         CASE WHEN e.hours >= 35 THEN 'Full time' ELSE 'Part time' END AS staff_type,
         e.hours,
         e.hire_date,
         e.salary AS yearly_salary,
         COALESCE(pt.gross_pay, 0) AS gross_pay,
         COALESCE(cyt.gross_pay, 0) +
         (
           e.salary / 24
         ) * (
           (12 - MONTH(CURDATE())) * 2 +
           CASE
             WHEN CURDATE() < DATE_FORMAT(CURDATE(), '%Y-%m-15') THEN 2
             WHEN CURDATE() < LAST_DAY(CURDATE()) THEN 1
             ELSE 0
           END
         ) AS projected_year_end_cost,
         COALESCE(
           (
             SELECT annual_salary_budget
             FROM salary_budget
             WHERE fiscal_year = YEAR(CURDATE())
             LIMIT 1
           ),
           0
         ) AS annual_salary_budget,
         YEAR(CURDATE()) AS salary_budget_year,
         COALESCE(ah.start_date, e.hire_date) AS start_date,
         TIMESTAMPDIFF(
           WEEK,
           COALESCE(ah.start_date, e.hire_date),
           CURDATE()
         ) AS tenure_weeks
       FROM EMPLOYEE e
       JOIN DEPARTMENT d ON d.department_ID = e.department_ID
       LEFT JOIN active_history ah ON ah.employee_ID = e.employee_ID
       LEFT JOIN payroll_totals pt ON pt.employee_ID = e.employee_ID
       LEFT JOIN current_year_totals cyt ON cyt.employee_ID = e.employee_ID
       WHERE ${employeeConditions.join(' AND ')}
       ORDER BY ${sortColumn} ${sortDirection}, e.employee_ID`,
		[...paycheckParams, ...employeeParams]
	);

	send(res, 200, rows);
	return true;
}

if (pathname === '/api/reports/revenue/transactions' && req.method === 'GET') {
	try {
		const parsedUrl = new URL(req.url, 'http://localhost');
		const category = parsedUrl.searchParams.get('stream_category');
		const streamName = parsedUrl.searchParams.get('stream_name');
		const timeFrame = parsedUrl.searchParams.get('time_frame') || 'ytd';
		let startDate = parsedUrl.searchParams.get('start_date');
		let endDate = parsedUrl.searchParams.get('end_date');

		if (!category || !streamName) {
			send(res, 400, { error: 'Stream category and name are required.' });
			return;
		}

		if (timeFrame === 'ytd') {
			const currentYear = new Date().getFullYear();
			startDate = `${currentYear}-01-01`;
			endDate = new Date().toISOString().split('T')[0];
		} else if (timeFrame === 'all') {
			startDate = null;
			endDate = null;
		} else if (timeFrame !== 'custom') {
			send(res, 400, { error: 'Invalid time frame.' });
			return;
		}

		if (startDate && endDate && startDate > endDate) {
			send(res, 400, { error: 'Start date cannot be after end date.' });
			return;
		}

		const addDateClause = (dateCol) => {
			let sql = '';
			if (startDate) sql += ` AND ${dateCol} >= ?`;
			if (endDate) sql += ` AND ${dateCol} <= ?`;
			return sql;
		};
		const dateParams = () => [
			...(startDate ? [startDate] : []),
			...(endDate ? [endDate] : [])
		];

		let query;
		let params;
		if (category === 'Admissions') {
			query = `
          SELECT
            'Ticket' AS record_type,
            t.ticket_ID AS record_ID,
            ti.transaction_ID,
            DATE_FORMAT(t.purchase_date, '%Y-%m-%d') AS transaction_date,
            t.ticket_type AS item_name,
            1 AS quantity,
            t.price AS unit_price,
            t.price AS amount,
            CONCAT('Visit date: ', DATE_FORMAT(t.visit_date, '%Y-%m-%d')) AS description,
            ct.payment_method
          FROM TICKET t
          LEFT JOIN TRANSACTION_ITEM ti
            ON ti.item_ID = t.ticket_ID AND ti.item_type = 'ticket'
          LEFT JOIN CUST_TRANSACTION ct ON ti.transaction_ID = ct.transaction_ID
          WHERE t.ticket_type = ? ${addDateClause('t.purchase_date')}
          ORDER BY t.purchase_date DESC, t.ticket_ID DESC
        `;
			params = [streamName, ...dateParams()];
		} else if (category === 'Fundraising') {
			query = `
          SELECT
            'Donation' AS record_type,
            d.donation_ID AS record_ID,
            ti.transaction_ID,
            DATE_FORMAT(d.donation_date, '%Y-%m-%d') AS transaction_date,
            d.purpose AS item_name,
            1 AS quantity,
            d.amount AS unit_price,
            d.amount AS amount,
            CONCAT('Donor #', d.donor_ID) AS description,
            ct.payment_method
          FROM DONATION d
          LEFT JOIN TRANSACTION_ITEM ti
            ON ti.item_ID = d.donation_ID AND ti.item_type = 'donation'
          LEFT JOIN CUST_TRANSACTION ct ON ti.transaction_ID = ct.transaction_ID
          WHERE d.purpose = ? ${addDateClause('d.donation_date')}
          ORDER BY d.donation_date DESC, d.donation_ID DESC
        `;
			params = [streamName, ...dateParams()];
		} else if (category === 'Retail Merchandise') {
			query = `
          SELECT
            ti.transaction_item_ID AS record_ID,
            ct.transaction_ID,
            DATE_FORMAT(ct.transaction_date, '%Y-%m-%d') AS transaction_date,
            COALESCE(p.name, CONCAT('Product #', ti.item_ID)) AS item_name,
            ti.quantity,
            ti.price AS unit_price,
            ti.price * ti.quantity AS amount,
            NULL AS description,
            ct.payment_method
          FROM TRANSACTION_ITEM ti
          JOIN CUST_TRANSACTION ct ON ti.transaction_ID = ct.transaction_ID
          LEFT JOIN PRODUCT p ON ti.item_ID = p.product_ID
          WHERE ti.item_type = 'product'
            AND COALESCE(p.name, CONCAT('Product #', ti.item_ID)) = ?
            ${addDateClause('DATE(ct.transaction_date)')}
          ORDER BY ct.transaction_date DESC, ti.transaction_ID DESC, ti.transaction_item_ID DESC
        `;
			params = [streamName, ...dateParams()];
		} else if (category === 'Food Concessions') {
			query = `
          SELECT
            ti.transaction_item_ID AS record_ID,
            ct.transaction_ID,
            DATE_FORMAT(ct.transaction_date, '%Y-%m-%d') AS transaction_date,
            COALESCE(m.name, CONCAT('Menu Item #', ti.item_ID)) AS item_name,
            ti.quantity,
            ti.price AS unit_price,
            ti.price * ti.quantity AS amount,
            NULL AS description,
            ct.payment_method
          FROM TRANSACTION_ITEM ti
          JOIN CUST_TRANSACTION ct ON ti.transaction_ID = ct.transaction_ID
          LEFT JOIN MENU_ITEM m ON ti.item_ID = m.item_ID
          WHERE ti.item_type = 'food'
            AND COALESCE(m.name, CONCAT('Menu Item #', ti.item_ID)) = ?
            ${addDateClause('DATE(ct.transaction_date)')}
          ORDER BY ct.transaction_date DESC, ti.transaction_ID DESC, ti.transaction_item_ID DESC
        `;
			params = [streamName, ...dateParams()];
		} else {
			send(res, 400, { error: 'Invalid revenue stream.' });
			return;
		}

		const [rows] = await pool.query(query, params);
		send(res, 200, rows);
		return;
	} catch (err) {
		console.error('Error fetching revenue transactions:', err);
		send(res, 500, { error: 'Could not load revenue transactions.' });
		return;
	}
	return true;
}

if (pathname === '/api/reports/revenue' && req.method === 'GET') {
	try {
		const parsedUrl = new URL(req.url, 'http://localhost');
		const streamType = parsedUrl.searchParams.get('stream_type') || 'all';
		const sortBy = parsedUrl.searchParams.get('sort_by') || 'revenue';
		const timeFrame = parsedUrl.searchParams.get('time_frame') || 'ytd';
		let startDate = parsedUrl.searchParams.get('start_date');
		let endDate = parsedUrl.searchParams.get('end_date');
		const minAmount = parsedUrl.searchParams.get('min_amount');
		const maxAmount = parsedUrl.searchParams.get('max_amount');

		if (timeFrame === 'ytd') {
			const currentYear = new Date().getFullYear();
			startDate = `${currentYear}-01-01`;
			endDate = new Date().toISOString().split('T')[0];
		} else if (timeFrame === 'all') {
			startDate = null;
			endDate = null;
		}

		const addDateClause = (dateCol) => {
			let sql = '';
			if (startDate) sql += ` AND ${dateCol} >= ?`;
			if (endDate) sql += ` AND ${dateCol} <= ?`;
			return sql;
		};

		const pushDates = () => {
			const p = [];
			if (startDate) p.push(startDate);
			if (endDate) p.push(endDate);
			return p;
		};

		const ticketsQuery = `
        SELECT
          'Admissions' AS stream_category,
          ticket_type AS stream_name,
          COUNT(*) AS transaction_count,
          COALESCE(SUM(price), 0) AS total_revenue,
          COALESCE(ROUND(AVG(price), 2), 0) AS avg_amount,
          COALESCE(MIN(price), 0) AS min_amount,
          COALESCE(MAX(price), 0) AS max_amount
        FROM TICKET
        WHERE 1=1 ${addDateClause('purchase_date')}
        GROUP BY ticket_type
      `;

		const donationsQuery = `
        SELECT
          'Fundraising' AS stream_category,
          purpose AS stream_name,
          COUNT(*) AS transaction_count,
          COALESCE(SUM(amount), 0) AS total_revenue,
          COALESCE(ROUND(AVG(amount), 2), 0) AS avg_amount,
          COALESCE(MIN(amount), 0) AS min_amount,
          COALESCE(MAX(amount), 0) AS max_amount
        FROM DONATION
        WHERE 1=1 ${addDateClause('donation_date')}
        GROUP BY purpose
      `;

		const retailQuery = `
        SELECT
          'Retail Merchandise' AS stream_category,
          COALESCE(p.name, CONCAT('Product #', ti.item_ID)) AS stream_name,
          COUNT(*) AS transaction_count,
          COALESCE(SUM(ti.price * ti.quantity), 0) AS total_revenue,
          COALESCE(ROUND(AVG(ti.price * ti.quantity), 2), 0) AS avg_amount,
          COALESCE(MIN(ti.price * ti.quantity), 0) AS min_amount,
          COALESCE(MAX(ti.price * ti.quantity), 0) AS max_amount
        FROM transaction_item ti
        JOIN cust_transaction ct ON ti.transaction_ID = ct.transaction_ID
        LEFT JOIN product p ON ti.item_ID = p.product_ID
        WHERE ti.item_type = 'product' ${addDateClause('DATE(ct.transaction_date)')}
        GROUP BY COALESCE(p.name, CONCAT('Product #', ti.item_ID))
      `;

		const foodSalesQuery = `
        SELECT
          'Food Concessions' AS stream_category,
          COALESCE(m.name, CONCAT('Menu Item #', ti.item_ID)) AS stream_name,
          COUNT(*) AS transaction_count,
          COALESCE(SUM(ti.price * ti.quantity), 0) AS total_revenue,
          COALESCE(ROUND(AVG(ti.price * ti.quantity), 2), 0) AS avg_amount,
          COALESCE(MIN(ti.price * ti.quantity), 0) AS min_amount,
          COALESCE(MAX(ti.price * ti.quantity), 0) AS max_amount
        FROM transaction_item ti
        JOIN cust_transaction ct ON ti.transaction_ID = ct.transaction_ID
        LEFT JOIN menu_item m ON ti.item_ID = m.item_ID
        WHERE ti.item_type = 'food' ${addDateClause('DATE(ct.transaction_date)')}
        GROUP BY COALESCE(m.name, CONCAT('Menu Item #', ti.item_ID))
      `;

		let innerQuery = '';
		let queryParams = [];

		if (streamType === 'tickets') {
			innerQuery = ticketsQuery;
			queryParams = pushDates();
		} else if (streamType === 'donations') {
			innerQuery = donationsQuery;
			queryParams = pushDates();
		} else if (streamType === 'retail') {
			innerQuery = retailQuery;
			queryParams = pushDates();
		} else if (streamType === 'food_sales') {
			innerQuery = foodSalesQuery;
			queryParams = pushDates();
		} else {
			innerQuery = `
          ${ticketsQuery}
          UNION ALL
          ${donationsQuery}
          UNION ALL
          ${retailQuery}
          UNION ALL
          ${foodSalesQuery}
        `;
			queryParams = [
				...pushDates(),
				...pushDates(),
				...pushDates(),
				...pushDates()
			];
		}

		const sortColumns = {
			revenue: 'total_revenue DESC',
			count: 'transaction_count DESC',
			avg: 'avg_amount DESC',
			name: 'stream_name ASC'
		};
		const orderClause = sortColumns[sortBy] || 'total_revenue DESC';

		let finalQuery = `SELECT * FROM (${innerQuery}) AS streams WHERE 1=1`;
		if (minAmount) {
			finalQuery += ' AND total_revenue >= ?';
			queryParams.push(Number(minAmount));
		}
		if (maxAmount) {
			finalQuery += ' AND total_revenue <= ?';
			queryParams.push(Number(maxAmount));
		}
		finalQuery += ` ORDER BY ${orderClause}`;

		const [rows] = await pool.query(finalQuery, queryParams);
		send(res, 200, rows);
		return;
	} catch (err) {
		console.error('Error fetching revenue report:', err);
		send(res, 500, { error: 'Could not load revenue report.' });
		return;
	}
	return true;
}

if (pathname === '/api/reports/financial-summary' && req.method === 'GET') {
	try {
		const parsedUrl = new URL(req.url, 'http://localhost');
		const timeFrame = parsedUrl.searchParams.get('time_frame') || 'ytd';
		let startDate = parsedUrl.searchParams.get('start_date');
		let endDate = parsedUrl.searchParams.get('end_date');

		if (timeFrame === 'ytd') {
			const currentYear = new Date().getFullYear();
			startDate = `${currentYear}-01-01`;
			endDate = new Date().toISOString().split('T')[0];
		} else if (timeFrame === 'all') {
			startDate = null;
			endDate = null;
		}

		const addDateClause = (dateCol) => {
			let sql = '';
			if (startDate) sql += ` AND ${dateCol} >= ?`;
			if (endDate) sql += ` AND ${dateCol} <= ?`;
			return sql;
		};

		const pushDates = () => {
			const p = [];
			if (startDate) p.push(startDate);
			if (endDate) p.push(endDate);
			return p;
		};

		const [[tickets]] = await pool.query(
			`SELECT COALESCE(SUM(price), 0) AS total FROM TICKET WHERE 1=1 ${addDateClause('purchase_date')}`,
			pushDates()
		);
		const [[donations]] = await pool.query(
			`SELECT COALESCE(SUM(amount), 0) AS total FROM DONATION WHERE 1=1 ${addDateClause('donation_date')}`,
			pushDates()
		);
		const [[retail]] = await pool.query(
			`SELECT COALESCE(SUM(ti.price * ti.quantity), 0) AS total
         FROM TRANSACTION_ITEM ti
         JOIN cust_transaction ct ON ti.transaction_ID = ct.transaction_ID
         WHERE ti.item_type = 'product' ${addDateClause('DATE(ct.transaction_date)')}`,
			pushDates()
		);
		const [[foodConcessions]] = await pool.query(
			`SELECT COALESCE(SUM(ti.price * ti.quantity), 0) AS total
         FROM TRANSACTION_ITEM ti
         JOIN cust_transaction ct ON ti.transaction_ID = ct.transaction_ID
         WHERE ti.item_type = 'food' ${addDateClause('DATE(ct.transaction_date)')}`,
			pushDates()
		);
		const [categories] = await pool.query(`
        SELECT cost_category, COALESCE(SUM(amount), 0) AS total
        FROM ENCLOSURE_COST
        WHERE 1=1 ${addDateClause('cost_date')}
        GROUP BY cost_category
        ORDER BY total DESC
      `, pushDates());
		const [medicalCategories] = await pool.query(`
        SELECT cost_category, COALESCE(SUM(total), 0) AS total
        FROM (
          SELECT cost_category, amount AS total
          FROM MEDICAL_COST
          WHERE 1=1 ${addDateClause('cost_date')}
          UNION ALL
          SELECT CONCAT('Animal Feeding: ', fi.food_category) AS cost_category, fc.amount AS total
          FROM FOOD_COST fc
          JOIN FEED_ITEM fi ON fc.food_ID = fi.food_ID
          WHERE 1=1 ${addDateClause('fc.cost_date')}
        ) AS healthcare_costs
        GROUP BY cost_category
        ORDER BY total DESC
      `, [...pushDates(), ...pushDates()]);

		const admissionsTotal = Number(tickets.total || 0);
		const donationsTotal = Number(donations.total || 0);
		const retailTotal = Number(retail.total || 0);
		const foodConcessionsTotal = Number(foodConcessions.total || 0);
		const grossRevenue = admissionsTotal + donationsTotal + retailTotal + foodConcessionsTotal;

		const enclosureCostsTotal = categories.reduce(
			(sum, category) => sum + Number(category.total || 0), 0
		);
		const medicalCostsTotal = medicalCategories.reduce(
			(sum, category) => sum + Number(category.total || 0), 0
		);
		const totalExpenses = enclosureCostsTotal + medicalCostsTotal;
		const netBalance = grossRevenue - totalExpenses;

		send(res, 200, {
			time_frame: timeFrame,
			start_date: startDate,
			end_date: endDate,
			gross_revenue: grossRevenue.toFixed(2),
			admissions_total: admissionsTotal.toFixed(2),
			donations_total: donationsTotal.toFixed(2),
			retail_total: retailTotal.toFixed(2),
			food_concessions_total: foodConcessionsTotal.toFixed(2),
			enclosure_costs_total: enclosureCostsTotal.toFixed(2),
			enclosure_categories: categories.map(category => ({
				category: category.cost_category,
				amount: Number(category.total || 0).toFixed(2)
			})),
			medical_costs_total: medicalCostsTotal.toFixed(2),
			medical_categories: medicalCategories.map(category => ({
				category: category.cost_category,
				amount: Number(category.total || 0).toFixed(2)
			})),
			total_expenses: totalExpenses.toFixed(2),
			net_balance: netBalance.toFixed(2)
		});
		return;
	} catch (err) {
		console.error('Error fetching financial summary:', err);
		send(res, 500, { error: 'Could not calculate financial summary.' });
		return;
	}
	return true;
}

return false;
}

module.exports = handleFinance;
