const defaultPool = require('../db');

function generatePaychecksForPeriod(employeeID, departmentID, salary, startDateStr, asOfDateStr = new Date()) {
	if (!startDateStr || Number(salary) <= 0) return [];

	const start = new Date(startDateStr);
	const asOf = new Date(asOfDateStr);
	if (Number.isNaN(start.getTime()) || Number.isNaN(asOf.getTime()) || start > asOf) {
		return [];
	}

	const periods = [];
	let year = start.getFullYear();
	let month = start.getMonth();

	while (new Date(year, month, 1) <= asOf) {
		const lastDay = new Date(year, month + 1, 0).getDate();
		const candidates = [
			[new Date(year, month, 1), new Date(year, month, 15)],
			[new Date(year, month, 16), new Date(year, month, lastDay)]
		];

		for (const [periodStart, periodEnd] of candidates) {
			if (periodEnd < start) continue;

			const toDate = date => date.toISOString().split('T')[0];
			periods.push([
				employeeID,
				departmentID,
				toDate(periodStart),
				toDate(periodEnd),
				toDate(periodEnd),
				Math.round((Number(salary) / 24) * 100) / 100,
				Math.round((Number(salary) / 24) * 0.12 * 100) / 100,
				Math.round((Number(salary) / 24) * 0.0765 * 100) / 100,
				0,
				Math.round((Number(salary) / 24) * 0.035 * 100) / 100,
				0,
				'direct_deposit'
			]);
		}

		month += 1;
		if (month === 12) {
			month = 0;
			year += 1;
		}
	}

	return periods.map(row => {
		const gross = row[5];
		const deductions = row[6] + row[7] + row[8] + row[9];
		row[10] = Math.round((gross - deductions) * 100) / 100;
		return row;
	});
}

async function generateDailyPaychecks(pool = defaultPool) {
	const [employees] = await pool.query(
		`SELECT employee_ID, department_ID, salary, hire_date
     FROM EMPLOYEE
     WHERE current = 1`
	);

	for (const employee of employees) {
		const paychecks = generatePaychecksForPeriod(
			employee.employee_ID,
			employee.department_ID,
			employee.salary,
			employee.hire_date
		);

		if (paychecks.length === 0) continue;

		const rows = paychecks.map((paycheck) => [
			paycheck[0],
			paycheck[1],
			paycheck[2],
			paycheck[3],
			paycheck[5],
			paycheck[6],
			paycheck[7],
			paycheck[9],
			paycheck[10]
		]);

		await pool.query(
			`INSERT INTO PAYCHECK
       (employee_ID, department_ID, pay_period_start, pay_period_end,
        gross_pay, federal_tax, fica_tax, benefits_deduction, net_pay)
       VALUES ?
       ON DUPLICATE KEY UPDATE paycheck_ID = paycheck_ID`,
			[rows]
		);
	}
}

module.exports = {
	generatePaychecksForPeriod,
	generateDailyPaychecks
};
