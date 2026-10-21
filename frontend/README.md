# Zoo frontend

## Run locally

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
