## Deployed at
https://victorious-field-058fd0510.5.azurestaticapps.net/

## Running site locally
1. Make sure MySQL is running and the backend is configured in `backend/.env`.
2. In one terminal, start the backend:

   ```bash
   cd backend
   npm install
   npm start
   ```

   The frontend currently requests the API at `http://localhost:5000`.
3. In another terminal, install and start the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Open the local URL printed by Vite, usually `http://localhost:5173`.

If port 5000 is occupied, set `PORT=5001` in `backend/.env` and update the API URL in the frontend to use port 5001.

## Other commands

```bash
npm run build
npm run lint
npm run preview 
```
## Demo Login Credentials
.....
### Department 1: Financial and HR
- **Department Head**: `taylor.hemsworth@zoo.com` / `taylor123` (HR Manager)
- **Employees**:
  - `sarah.connor@zoo.com` / `sarah123` (HR Assistant)
  - `jim.cruise@zoo.com` / `jim123` (HR Assistant)

### Department 2: Animal Operations
- **Department Head**: `tlopez721@gmail.com` / `tawney123` (Animal Operations Manager)
- **Employees**:
  - `morgan.lawrence@zoo.com` / `morgan123` (Veterinarian)
  - `ariana.winslet@zoo.com` / `ariana123` (Keeper)
  - `chloe.bennett@zoo.com` / `chloe123` (Vet Assistant)
  - `ellen.rogan@zoo.com` / `ellen123` (Vet Tech)
  - `justin.damon@zoo.com` / `justin123` (Vet Tech)
  - `justin.perry@zoo.com` / `justin123` (Keeper)
  - `katy.hart@zoo.com` / `katy123` (Keeper)
  - `leo.dicaprio@zoo.com` / `leo123` (Keeper)

### Department 3: Commercial Operations
- **Department Head**: `ktap1000@gmail.com` / `emma123` (Commercial Operations Manager - Khadeeja Tapkirwala)
- **Employees**:
  - `gordon.ramsay@zoo.com` / `gordon123` (Food Stall Associate)
  - `tom.hardy@zoo.com` / `tom123` (Retail Associate)
  - `mia.goth@zoo.com` / `mia123` (Food Stall Associate)

### Department 4: Guest Operations
- **Department Head**: `rachel.green@zoo.com` / `rachel123` (Guest Operations Manager)
- **Employees**:
  - `chris.pratt@zoo.com` / `chris123` (Tour Guide)
  - `zendaya.coleman@zoo.com` / `zendaya123` (Tour Guide)

### Public Visitors
- `visitor@zoo.com` / `visitor123` (Khadeeja Tapkirwala)
- `olumide.a810@gmail.com` / `Wacko910` (Olumide Aina)
- `sallu@gmail.com` / `sallu123` (sallu tap)
