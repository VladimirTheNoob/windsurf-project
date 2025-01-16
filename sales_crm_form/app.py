from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
from datetime import datetime

# Configure the application
app = Flask(__name__, static_folder='.', static_url_path='/')
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes

# Configure SQLite database
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'crm_database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db = SQLAlchemy(app)

# CRM Entry Model
class CRMEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    person_name = db.Column(db.String(100), nullable=False)
    company_name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100))
    case = db.Column(db.String(200))
    next_steps = db.Column(db.Text)
    status = db.Column(db.String(50))
    description = db.Column(db.Text)
    sale_person = db.Column(db.String(100), nullable=False)
    submission_time = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'person_name': self.person_name,
            'company_name': self.company_name,
            'department': self.department,
            'case': self.case,
            'next_steps': self.next_steps,
            'status': self.status,
            'description': self.description,
            'sale_person': self.sale_person,
            'submission_time': self.submission_time.isoformat() if self.submission_time else None
        }

# Create database tables
with app.app_context():
    db.create_all()

# Routes
@app.route('/submit_crm', methods=['POST'])
def submit_crm():
    try:
        # Ensure request is JSON
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400

        data = request.get_json()
        
        # Validate required fields
        required_fields = ['person_name', 'company_name', 'sale_person']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Create new CRM entry
        new_entry = CRMEntry(
            person_name=data['person_name'],
            company_name=data['company_name'],
            department=data.get('department', ''),
            case=data.get('case', ''),
            next_steps=data.get('next_steps', ''),
            status=data.get('status', ''),
            description=data.get('description', ''),
            sale_person=data['sale_person']
        )

        # Add and commit to database
        db.session.add(new_entry)
        db.session.commit()

        return jsonify({
            'message': 'CRM entry submitted successfully', 
            'entry_id': new_entry.id
        }), 201

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error submitting CRM entry: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_crm_entries', methods=['GET'])
def get_crm_entries():
    try:
        # Optional filtering
        status = request.args.get('status')
        sale_person = request.args.get('sale_person')

        query = CRMEntry.query

        if status:
            query = query.filter_by(status=status)
        
        if sale_person:
            query = query.filter_by(sale_person=sale_person)

        entries = query.order_by(CRMEntry.submission_time.desc()).all()
        
        return jsonify([entry.to_dict() for entry in entries]), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/clear_crm_entries', methods=['DELETE'])
def clear_crm_entries():
    try:
        # Delete all entries
        deleted_count = db.session.query(CRMEntry).delete()
        db.session.commit()

        return jsonify({
            'message': 'All CRM entries cleared successfully', 
            'deleted_count': deleted_count
        }), 200

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error clearing CRM entries: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/retrieve_data')
def serve_retrieve_data():
    return send_from_directory('.', 'retrieve_data.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
