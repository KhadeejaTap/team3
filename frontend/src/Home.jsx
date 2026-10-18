import './App.css'
/*function EmpView() {
	const [employees, setEmployees] = useState([])

	useEffect(() => {
		fetch('http://localhost:5000/api/employees').then((res) => res.json()).then((data) => setEmployees(data)).catch((err) => console.error('Error fetching employees:', err));
	}, []);
*/
function Home() {
	return (
		<>
			<div>
				<h2> Super Cool Zoo </h2>
			</div>
		</>
	);
}
export default Home;
