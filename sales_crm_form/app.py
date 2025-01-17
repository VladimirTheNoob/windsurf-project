from flask import Flask, request, jsonify, send_from_directory, redirect, url_for, render_template, flash
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
import os
import logging
from datetime import datetime, timedelta
import re
from sqlalchemy import func, or_
from sqlalchemy.exc import SQLAlchemyError

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Set to DEBUG to capture all log levels
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app_debug.log'),  # Log to file
        logging.StreamHandler()  # Also log to console
    ]
)

# Configure the application
app = Flask(__name__, 
            static_folder='.', 
            static_url_path='/', 
            template_folder='.')
app.config['SECRET_KEY'] = os.urandom(24)  # Important for session security
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=1)

# Configure CORS with more permissive settings
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "methods": ["GET", "POST", "OPTIONS"]
    }
})

# Configure SQLite database
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'crm_database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.session_protection = 'strong'
login_manager.remember_cookie_duration = timedelta(days=1)

# Global error handler
@app.errorhandler(Exception)
def handle_global_exception(e):
    # Log the full traceback
    import traceback
    logging.error("Unhandled Exception:", exc_info=True)
    
    # Prepare error details
    error_details = {
        'error': 'Internal Server Error',
        'details': str(e),
        'traceback': traceback.format_exc()
    }
    
    # Return JSON response with error details
    return jsonify(error_details), 500

# Modify login_required decorator to return JSON
login_manager.unauthorized_handler(lambda: (jsonify({
    'error': 'Unauthorized',
    'details': 'Authentication required'
}), 401))

# Ensure all routes use JSON responses for errors
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Not Found',
        'details': 'The requested resource could not be found'
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        'error': 'Method Not Allowed',
        'details': 'The method is not allowed for this endpoint'
    }), 405

# Ensure error details are logged
@app.errorhandler(Exception)
def handle_exception(e):
    logging.error(f"Unhandled Exception: {str(e)}", exc_info=True)
    return "An internal error occurred", 500

# User Model
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)

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

# User Loader for Flask-Login
@login_manager.user_loader
def load_user(user_id):
    try:
        return User.query.get(int(user_id))
    except Exception as e:
        logging.error(f"Error loading user {user_id}: {str(e)}")
        return None

# Email validation function
def is_valid_email(email):
    """Validate email format using a simple regex pattern."""
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(email_regex, email) is not None

# Authentication Routes
@app.route('/', methods=['GET'])
def root():
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    # Get the 'next' parameter from request
    next_page = request.args.get('next') or request.form.get('next')

    # If user is already logged in, redirect to home or requested page
    if current_user.is_authenticated:
        logging.info(f"User already authenticated. Redirecting to {next_page or 'index'}")
        if next_page:
            return redirect(next_page)
        return redirect(url_for('index'))

    if request.method == 'POST':
        # Attempt to parse JSON or form data
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form

        # Support both email and username login
        login_identifier = data.get('username') or data.get('email')
        password = data.get('password')

        # Validate input
        if not login_identifier or not password:
            logging.warning("Login attempt with missing credentials")
            return jsonify({'error': 'Invalid credentials'}), 400

        # Find user by email or username (case-insensitive)
        user = (User.query.filter(func.lower(User.email) == func.lower(login_identifier)).first() or 
                User.query.filter(func.lower(User.username) == func.lower(login_identifier)).first())

        # Verify credentials
        if user and bcrypt.check_password_hash(user.password, password):
            # Login successful
            # Explicitly set remember=True to maintain session
            login_user(user, remember=True)
            
            # Log login success
            logging.info(f"User {user.username} logged in successfully")
            
            # Determine redirect URL
            redirect_url = next_page or url_for('index')
            logging.info(f"Redirecting to: {redirect_url}")
            
            # Return JSON response with redirect information
            return jsonify({
                'message': 'Login successful', 
                'redirect': redirect_url,
                'username': user.username  # Include username in response
            }), 200
        else:
            # Login failed
            logging.warning(f"Failed login attempt for identifier: {login_identifier}")
            return jsonify({'error': 'Invalid username or password'}), 401

    # GET request: render login page
    return render_template('login.html', next=next_page)

@app.route('/register', methods=['GET', 'POST'])
def register():
    try:
        if request.method == 'POST':
            username = request.form.get('username')
            email = request.form.get('email')
            password = request.form.get('password')
            
            # Validate email
            if not is_valid_email(email):
                flash('Invalid email format')
                return redirect(url_for('register'))
            
            # Check if user already exists
            existing_user = User.query.filter((User.username == username) | (User.email == email)).first()
            if existing_user:
                flash('Username or email already exists')
                return redirect(url_for('register'))
            
            # Hash password
            hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
            
            # Create new user
            new_user = User(username=username, email=email, password=hashed_password)
            db.session.add(new_user)
            db.session.commit()
            
            flash('Registration successful. Please log in.')
            return redirect(url_for('login'))
        
        return render_template('register.html')
    except Exception as e:
        logging.error(f"Registration error: {str(e)}", exc_info=True)
        flash('An error occurred during registration')
        return render_template('register.html'), 500

@app.route('/logout')
def logout():
    try:
        # Check if user is authenticated before attempting logout
        if current_user.is_authenticated:
            username = current_user.username
            logout_user()
            logging.info(f"User {username} logged out successfully")
            return redirect(url_for('login'))
        else:
            # If not authenticated, log and redirect to login
            logging.warning("Logout attempted by unauthenticated user")
            return redirect(url_for('login'))
    except Exception as e:
        # Comprehensive error logging
        logging.error(f"Logout error: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Logout failed', 
            'details': str(e)
        }), 500

# Protect routes that require authentication
@app.route('/index')
@login_required
def index():
    try:
        # Extensive logging for debugging authentication
        logging.info("Entering index route")
        logging.info(f"Current User Authenticated: {current_user.is_authenticated}")
        
        # Check if current_user is actually a User instance
        if current_user.is_authenticated:
            logging.info(f"Current User Type: {type(current_user)}")
            logging.info(f"Current User Dict: {current_user.__dict__}")
            
            # Explicitly get username, with fallback
            username = getattr(current_user, 'username', 'Unknown User')
            logging.info(f"Rendering index with username: {username}")
            
            return render_template('index.html', username=username)
        else:
            logging.warning("Unauthenticated user attempting to access index")
            return redirect(url_for('login'))
    except Exception as e:
        # Comprehensive error logging
        logging.error(f"Error in index route: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Internal Server Error', 
            'details': str(e)
        }), 500

@app.route('/retrieve_data')
@login_required
def retrieve_data():
    # Check if user is authenticated
    if not current_user.is_authenticated:
        # Redirect to login page with a message
        flash('Please log in to access CRM data', 'warning')
        return redirect(url_for('login', next=request.url))
    
    # Render the retrieve_data template for authenticated users
    return render_template('retrieve_data.html', username=current_user.username)

# Routes
@app.route('/submit_crm', methods=['POST', 'OPTIONS'])
@login_required
def submit_crm():
    # Log all request details at the start
    logging.debug("Submit CRM Request Received")
    logging.debug(f"Request Method: {request.method}")
    logging.debug(f"Request Headers: {dict(request.headers)}")
    logging.debug(f"Request Content Type: {request.content_type}")
    
    # Handle OPTIONS (CORS preflight) requests
    if request.method == 'OPTIONS':
        response = jsonify({'message': 'Preflight check passed'})
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        return response

    try:
        # Attempt to parse JSON
        try:
            data = request.get_json(force=True)  # Force parsing even if content type is incorrect
        except Exception as json_error:
            logging.error(f"JSON parsing error: {str(json_error)}")
            return jsonify({
                'error': 'JSON Parsing Error',
                'details': str(json_error),
                'received_data': request.get_data(as_text=True)
            }), 400

        # Log parsed data for debugging
        logging.debug(f"Parsed JSON data: {data}")
        
        # Extract data with fallback
        person_name = data.get('name') or data.get('person_name')
        company_name = data.get('company') or data.get('company_name')
        
        # Additional fields
        department = data.get('department', '')
        case = data.get('case', '')
        next_steps = data.get('next_steps', '')
        status = data.get('status', '')
        description = data.get('notes', '') or data.get('description', '')
        
        # Validate required fields
        if not person_name or not company_name:
            logging.error("Missing required fields")
            return jsonify({
                'error': 'Missing required fields',
                'details': 'Person name and company name are mandatory',
                'received_data': data
            }), 400
        
        # Create new CRM entry
        try:
            new_entry = CRMEntry(
                person_name=person_name, 
                company_name=company_name, 
                department=department,
                case=case,
                next_steps=next_steps,
                status=status,
                description=description,
                sale_person=current_user.username  # Link entry to current user
            )
            
            # Add and commit the entry
            db.session.add(new_entry)
            db.session.commit()
            
            logging.info(f"CRM entry added successfully for {person_name}")
            return jsonify({
                'message': 'CRM entry added successfully',
                'entry_id': new_entry.id
            }), 201
        
        except SQLAlchemyError as db_error:
            # Rollback the session in case of database error
            db.session.rollback()
            
            # Log detailed database error
            logging.error(f"Database error when adding CRM entry: {str(db_error)}")
            
            return jsonify({
                'error': 'Database error',
                'details': str(db_error)
            }), 500
    
    except Exception as e:
        # Catch any other unexpected errors
        logging.error(f"Unexpected error in submit_crm: {str(e)}", exc_info=True)
        
        return jsonify({
            'error': 'Unexpected server error',
            'details': str(e)
        }), 500

@app.route('/get_crm_entries', methods=['GET'])
@login_required
def get_crm_entries():
    try:
        # Get filter parameters from request
        sale_person = request.args.get('sale_person', '').strip()
        case_filter = request.args.get('case', '').strip()
        
        # Start with base query
        query = CRMEntry.query
        
        # Apply sale person filter if provided
        if sale_person:
            query = query.filter(CRMEntry.sale_person.ilike(f'%{sale_person}%'))
        
        # Apply case filter if provided (case-insensitive partial match)
        if case_filter:
            query = query.filter(CRMEntry.case.ilike(f'%{case_filter}%'))
        
        # Execute query and convert to list of dictionaries
        entries = [entry.to_dict() for entry in query.all()]
        
        # Log the number of entries retrieved
        logging.info(f"Retrieved {len(entries)} CRM entries with filters: sale_person='{sale_person}', case='{case_filter}'")
        
        # Return entries as JSON
        return jsonify(entries)
    except Exception as e:
        # Log and return error
        logging.error(f"Error retrieving CRM entries: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Failed to retrieve CRM entries',
            'details': str(e)
        }), 500

@app.route('/clear_crm_entries', methods=['DELETE'])
@login_required
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
        logging.error(f"Error clearing CRM entries: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/reset_users', methods=['GET'])
def reset_users():
    try:
        # Delete all users from the database
        num_users_deleted = User.query.delete()
        
        # Commit the deletion
        db.session.commit()
        
        # Log the action
        logging.warning(f"All users have been deleted. Total users removed: {num_users_deleted}")
        
        # Flash a message about the deletion
        flash(f'All {num_users_deleted} users have been deleted.')
        
        # Redirect to login page
        return redirect(url_for('login'))
    except Exception as e:
        # Rollback in case of error
        db.session.rollback()
        
        # Log the error
        logging.error(f"Error resetting users: {str(e)}", exc_info=True)
        
        # Flash an error message
        flash('An error occurred while resetting users.')
        
        return redirect(url_for('login'))

@app.route('/favicon.ico')
def favicon():
    try:
        return send_from_directory('.', 'logo.png', mimetype='image/png')
    except Exception as e:
        logging.error(f"Favicon error: {str(e)}")
        return '', 404

# Create database tables
with app.app_context():
    try:
        db.create_all()
        logging.info("Database tables created successfully")
    except Exception as e:
        logging.error(f"Error creating database tables: {str(e)}")

if __name__ == '__main__':
    app.run(debug=True, port=5000)
