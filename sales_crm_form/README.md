# Sales CRM Form

## Project Setup

### Prerequisites
- Python 3.8+
- pip

### Installation
1. Clone the repository
2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

### Running the Application
1. Start the Backend Server:
   ```
   python app.py
   ```
   The server will run on `http://localhost:5000`

2. Open `index.html` in a web browser

### Features
- Submit CRM entries with validation
- Store entries in SQLite database
- Retrieve CRM entries with optional filtering

### Endpoints
- `POST /submit_crm`: Submit a new CRM entry
- `GET /get_crm_entries`: Retrieve CRM entries (with optional status and sale person filters)

### Technologies
- Frontend: HTML, CSS, JavaScript
- Backend: Flask
- Database: SQLite
