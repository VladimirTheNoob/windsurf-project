from flask import Flask, request, jsonify, send_from_directory, redirect, url_for, render_template, flash, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
import os
import logging
from datetime import datetime
import re
from sqlalchemy import func, or_
from sqlalchemy.exc import SQLAlchemyError
import logging
import urllib.parse
import jwt
import time
import json

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

# Configure CORS with more flexible settings
cors = CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:5000",
            "http://127.0.0.1:5000",
            "https://mavericka-crm.netlify.app",
            "http://localhost:8000",  # Common dev server port
            "http://127.0.0.1:8000",
            "*"  # Be cautious with this in production
        ],
        "methods": ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
        "allow_headers": [
            "Content-Type", 
            "Authorization", 
            "Access-Control-Allow-Credentials", 
            "X-Requested-With",
            "Accept"
        ],
        "supports_credentials": True
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

# Modify login_required decorator to return JSON with more context
login_manager.unauthorized_handler(lambda: (
    jsonify({
        'error': 'Unauthorized',
        'details': 'Authentication required',
        'redirect': url_for('login', 
            next=request.endpoint or request.path, 
            reason=urllib.parse.quote('Please log in to access this page.'), 
            _external=True
        )
    }), 
    401
))

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

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password, password)

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

# Generate token function
def generate_token(user):
    payload = {
        'exp': int(time.time()) + 3600,  # Token expires in 1 hour
        'iat': int(time.time()),
        'sub': user.id
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

# Authentication Routes
@app.route('/login', methods=['GET', 'POST', 'OPTIONS'])
@app.route('/api/login', methods=['GET', 'POST', 'OPTIONS'])
def login():
    # Handle CORS preflight request for both routes
    if request.method == 'OPTIONS':
        # Preflight response
        response = make_response()
        
        # Allow origin from the request or use a default
        origin = request.headers.get('Origin', '*')
        response.headers.add("Access-Control-Allow-Origin", origin)
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        
        return response, 204

    # Determine the request content type and parse accordingly
    if request.method == 'POST':
        # Try parsing JSON first
        data = request.get_json(silent=True)
        
        # If JSON parsing fails, try form data
        if not data:
            data = request.form.to_dict()
        
        # If still no data, try parsing raw data
        if not data:
            try:
                data = json.loads(request.data.decode('utf-8'))
            except:
                data = {}

        # Log incoming request details for debugging
        app.logger.info(f"Login request received. Method: {request.method}, Data: {data}")

        # Extract login credentials
        login_identifier = data.get('loginIdentifier') or data.get('username') or data.get('email')
        password = data.get('password')

        # Validate input
        if not login_identifier or not password:
            app.logger.warning("Login attempt with missing credentials")
            return jsonify({
                'success': False,
                'error': 'Missing login credentials',
                'details': 'Please provide both login identifier and password'
            }), 400

        try:
            # Find user by email or username
            user = User.query.filter(
                or_(
                    func.lower(User.email) == func.lower(login_identifier),
                    func.lower(User.username) == func.lower(login_identifier)
                )
            ).first()

            # Verify credentials
            if user and user.check_password(password):
                # Log successful login attempt
                app.logger.info(f"Successful login for user: {user.username}")

                # Create a session for the user
                login_user(user)

                # Generate a token (optional, for client-side storage)
                token = generate_token(user)

                # Determine next page (with fallback)
                next_page = (
                    data.get('nextPage') or 
                    request.args.get('next') or 
                    url_for('index')
                )

                # Prepare response
                response_data = {
                    'success': True,
                    'message': 'Login successful',
                    'username': user.username,
                    'token': token,
                    'nextPage': next_page
                }

                # Create JSON response
                response = jsonify(response_data)
                
                # Set secure cookie for authentication
                response.set_cookie('authToken', token, 
                    httponly=True, 
                    secure=True, 
                    samesite='Strict', 
                    max_age=3600  # 1 hour
                )

                # Add CORS headers dynamically
                origin = request.headers.get('Origin', '*')
                response.headers.add("Access-Control-Allow-Origin", origin)
                response.headers.add('Access-Control-Allow-Credentials', 'true')

                return response, 200
            else:
                # Log failed login attempt
                app.logger.warning(f"Failed login attempt for identifier: {login_identifier}")
                
                return jsonify({
                    'success': False,
                    'error': 'Invalid credentials',
                    'details': 'The provided login credentials are incorrect'
                }), 401

        except Exception as e:
            # Log unexpected errors
            app.logger.error(f"Login error: {str(e)}", exc_info=True)
            
            return jsonify({
                'success': False,
                'error': 'Login process failed',
                'details': str(e)
            }), 500

    # GET request: render login page or return JSON
    if request.headers.get('Accept', '').find('application/json') != -1:
        return jsonify({
            'message': 'Login page',
            'methods': ['POST']
        }), 200
    
    # Render login page for web browsers
    return render_template('login.html')

@app.route('/index')
@login_required
def index():
    # Serve index.html for authenticated users
    return send_from_directory('.', 'index.html')

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

@app.route('/logout', methods=['GET', 'POST', 'OPTIONS'])
def logout():
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        return '', 204

    # If user is not authenticated, return a success-like response
    if not current_user.is_authenticated:
        return jsonify({
            'message': 'Logout successful',
            'redirect': url_for('login', _external=True)
        }), 200
    
    try:
        # Log the user being logged out
        username = current_user.username
        logging.info(f"Logging out user: {username}")
        
        # Perform logout
        logout_user()
        
        # Construct full login URL
        login_url = request.host_url.rstrip('/') + url_for('login')
        
        # Return JSON response for frontend with explicit content type
        response = jsonify({
            'message': 'Logout successful',
            'redirect': login_url
        })
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        return response, 200
    except Exception as e:
        # Log any unexpected errors
        logging.error(f"Logout error: {str(e)}", exc_info=True)
        
        # Return error JSON response
        error_response = jsonify({
            'error': 'Logout failed',
            'details': str(e)
        })
        error_response.headers['Content-Type'] = 'application/json; charset=utf-8'
        return error_response, 500

# Protect routes that require authentication
@app.route('/retrieve_data')
def retrieve_data():
    # Check if user is authenticated
    if not current_user.is_authenticated:
        # Redirect to login page with a message
        flash('Please log in to access CRM data', 'warning')
        return redirect(url_for('login', next=request.url))
    
    # Render the retrieve_data template for authenticated users
    return render_template('retrieve_data.html')

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

@app.route('/get_crm_entries', methods=['GET', 'POST', 'OPTIONS'])
@login_required
def get_crm_entries():
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        return '', 204

    try:
        # Extract query parameters for filtering
        sale_person = request.args.get('sale_person', type=str)
        status = request.args.get('status', type=str)

        # Base query
        query = CRMEntry.query

        # Apply filters if provided
        if sale_person:
            query = query.filter(CRMEntry.sale_person == sale_person)
        
        if status:
            query = query.filter(CRMEntry.status == status)

        # Order by submission time, most recent first
        query = query.order_by(CRMEntry.submission_time.desc())

        # Fetch entries
        entries = query.all()

        # Convert entries to list of dictionaries
        entries_list = [entry.to_dict() for entry in entries]

        # Return JSON response
        response = jsonify(entries_list)
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        return response, 200

    except SQLAlchemyError as e:
        # Log database-related errors
        logging.error(f"Database error retrieving CRM entries: {str(e)}", exc_info=True)
        
        error_response = jsonify({
            'error': 'Database error',
            'details': str(e)
        })
        error_response.headers['Content-Type'] = 'application/json; charset=utf-8'
        return error_response, 500
    
    except Exception as e:
        # Log unexpected errors
        logging.error(f"Unexpected error retrieving CRM entries: {str(e)}", exc_info=True)
        
        error_response = jsonify({
            'error': 'Unexpected error',
            'details': str(e)
        })
        error_response.headers['Content-Type'] = 'application/json; charset=utf-8'
        return error_response, 500

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
