/**
 * Express.js Server for Local Image Gallery
 * 
 * This server provides a RESTful API for uploading and retrieving images.
 * It uses multer for handling multipart/form-data file uploads and PocketBase
 * as a backend database to store image metadata. The actual image files are
 * stored on the local filesystem in the 'uploads' directory.
 */

// ============================================================================
// DEPENDENCIES
// ============================================================================

// Express.js - Web framework for Node.js, handles HTTP requests and routing
const express = require('express');

// Multer - Middleware for handling multipart/form-data, specifically designed
// for uploading files. It adds a 'file' or 'files' object to the request.
const multer = require('multer');

// Path - Node.js built-in module for working with file and directory paths.
// Provides utilities for path manipulation that work across different OS.
const path = require('path');

// FS (File System) - Node.js built-in module for interacting with the file system.
// Used here to check if directories exist and create them if needed.
const fs = require('fs');

// PocketBase - A lightweight backend-as-a-service (BaaS) solution. Used here
// to store and retrieve image metadata (name, location, mime_type, etc.)
const PocketBase = require('pocketbase').default;

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

// Create an Express application instance
const app = express();

// Server port configuration - Uses environment variable if set, otherwise defaults to 3000.
// This allows flexibility for deployment environments (Docker, cloud platforms, etc.)
const PORT = process.env.PORT || 3000;

// PocketBase URL configuration - The base URL where PocketBase is running.
// Defaults to localhost:8080 for local development, but can be overridden via environment variable.
const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://localhost:8080';

// Upload directory path - Absolute path to the directory where uploaded images will be stored.
// Uses path.join() to ensure cross-platform compatibility (handles Windows/Unix path differences)
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Maximum file size limit - Set to 10MB (10 * 1024 * 1024 bytes).
// This prevents users from uploading excessively large files that could consume server resources.
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ============================================================================
// DIRECTORY SETUP
// ============================================================================

// Ensure the uploads directory exists before the server starts accepting uploads.
// This prevents errors if the directory hasn't been created yet.
// fs.existsSync() checks if the directory exists synchronously.
// fs.mkdirSync() creates the directory with 'recursive: true' to create parent directories if needed.
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ============================================================================
// POCKETBASE CLIENT INITIALIZATION
// ============================================================================

// Initialize the PocketBase client with the configured URL.
// This client will be used to interact with the PocketBase API for CRUD operations.
const pb = new PocketBase(POCKETBASE_URL);

// Health check for PocketBase collection - Verifies that the 'images' collection exists
// and is accessible. This is a fallback check in case migrations haven't run yet.
// Uses setTimeout to give PocketBase time to fully initialize (3 second delay).
// Attempts to fetch at least one record from the 'images' collection to verify it exists.
setTimeout(async () => {
  try {
    // Try to fetch one record from the images collection to verify it's ready
    await pb.collection('images').getFullList({ limit: 1 });
    console.log('PocketBase images collection is ready');
  } catch (error) {
    // If the collection doesn't exist or isn't ready, log a warning but don't crash.
    // The migration script should handle creating the collection, but this provides feedback.
    console.warn('PocketBase collection not ready yet:', error.message);
  }
}, 3000);

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

// Configure multer to use disk storage (files saved to filesystem rather than memory).
// This is more memory-efficient for larger files and allows files to persist after upload.
const storage = multer.diskStorage({
  // Destination callback - Determines where uploaded files should be stored.
  // Called for each file upload to specify the destination directory.
  destination: (req, file, cb) => {
    // Callback with null (no error) and the upload directory path
    cb(null, UPLOAD_DIR);
  },
  
  // Filename callback - Determines the name of the uploaded file.
  // This prevents filename conflicts and overwrites by generating unique names.
  filename: (req, file, cb) => {
    // Generate a unique filename using timestamp and random number to prevent collisions.
    // Format: [timestamp]-[random number].[original extension]
    // Example: 1763578360378-911074405.jpeg
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    
    // Extract the original file extension (e.g., .jpg, .png) to preserve file type
    const ext = path.extname(file.originalname);
    
    // Callback with the generated unique filename
    cb(null, uniqueSuffix + ext);
  }
});

// File filter function - Validates file types before accepting uploads.
// This is a security measure to prevent uploading non-image files or malicious content.
const fileFilter = (req, file, cb) => {
  // Define allowed MIME types for images
  // MIME types are the standard way to identify file types on the web
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  
  // Check if the uploaded file's MIME type is in the allowed list
  if (allowedTypes.includes(file.mimetype)) {
    // Accept the file - first parameter is null (no error), second is true (accept file)
    cb(null, true);
  } else {
    // Reject the file - first parameter is an Error object, second is false (reject file)
    cb(new Error('Invalid file type. Only JPG, PNG, and GIF are allowed.'), false);
  }
};

// Create the multer middleware instance with the configured storage, limits, and filter.
// This middleware will be used in the upload route to handle file uploads.
const upload = multer({
  storage: storage,           // Use the disk storage configuration defined above
  limits: { fileSize: MAX_FILE_SIZE },  // Enforce the 10MB file size limit
  fileFilter: fileFilter     // Apply the file type validation
});

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

// JSON body parser middleware - Parses incoming request bodies in JSON format.
// This allows the server to automatically parse JSON data from POST/PUT requests.
// Without this, req.body would be undefined for JSON requests.
app.use(express.json());

// URL-encoded body parser middleware - Parses incoming request bodies in URL-encoded format
// (application/x-www-form-urlencoded). The 'extended: true' option allows parsing of
// rich objects and arrays in the URL-encoded format. This is commonly used with HTML forms.
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// STATIC FILE SERVING
// ============================================================================

// Serve static files from the 'public' directory.
// This makes files in the public directory (HTML, CSS, JS) accessible at the root URL.
// For example, public/index.html becomes accessible at http://localhost:3000/index.html
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded images from the uploads directory at the '/uploads' URL path.
// This allows the frontend to display images using URLs like /uploads/filename.jpg
// The express.static middleware serves files from the specified directory.
app.use('/uploads', express.static(UPLOAD_DIR));

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * POST /upload - Image Upload Endpoint
 * 
 * Handles multipart/form-data file uploads. Accepts a single image file,
 * saves it to the filesystem, and stores its metadata in PocketBase.
 * 
 * Expected request format:
 * - Content-Type: multipart/form-data
 * - Field name: 'image' (must match upload.single('image'))
 * 
 * Response on success:
 * - Status: 200 OK
 * - Body: { success: true, message: string, data: PocketBase record }
 * 
 * Response on error:
 * - Status: 400 (no file) or 500 (server error)
 * - Body: { error: string, message: string }
 */
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    // Check if a file was actually uploaded
    // req.file is added by multer middleware when a file is successfully uploaded
    if (!req.file) {
      // Return 400 Bad Request if no file was provided
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Construct the public URL path for the uploaded file
    // This path will be used by the frontend to display the image
    const filePath = `/uploads/${req.file.filename}`;
    
    // Prepare image metadata object to store in PocketBase
    // This metadata allows us to retrieve and display images without querying the filesystem
    const imageData = {
      name: req.file.originalname,      // Original filename as uploaded by user
      location: filePath,                // Public URL path to access the image
      mime_type: req.file.mimetype      // MIME type (e.g., 'image/jpeg') for proper rendering
    };

    // Save the image metadata to PocketBase 'images' collection
    // This creates a new record in the database with the image information
    // The record will include auto-generated fields like 'id' and 'created' timestamp
    const record = await pb.collection('images').create(imageData);

    // Return success response with the created record
    // The record includes the PocketBase-generated ID and timestamps
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: record
    });
  } catch (error) {
    // Log the full error for debugging purposes
    console.error('Upload error:', error);
    
    // Return a 500 Internal Server Error response
    // Include error message for client-side error handling
    res.status(500).json({
      error: 'Failed to upload image',
      message: error.message
    });
  }
});

/**
 * GET /api/images - Retrieve All Images Endpoint
 * 
 * Fetches all image records from PocketBase and returns them as JSON.
 * Images are sorted by creation date in descending order (newest first).
 * 
 * Response on success:
 * - Status: 200 OK
 * - Body: Array of image records from PocketBase
 * 
 * Response on error:
 * - Status: 500 Internal Server Error
 * - Body: { error: string, message: string }
 */
app.get('/api/images', async (req, res) => {
  try {
    // Fetch all records from the 'images' collection in PocketBase
    // getFullList() retrieves all records (not paginated)
    // sort: '-created' sorts by creation date in descending order (newest first)
    // The '-' prefix indicates descending order
    const records = await pb.collection('images').getFullList({
      sort: '-created'
    });
    
    // Return the array of image records as JSON
    // Each record contains: id, name, location, mime_type, created, updated, etc.
    res.json(records);
  } catch (error) {
    // Log the error for debugging
    console.error('Error fetching images:', error);
    
    // Return 500 Internal Server Error with error details
    res.status(500).json({
      error: 'Failed to fetch images',
      message: error.message
    });
  }
});

/**
 * GET /health - Health Check Endpoint
 * 
 * Simple endpoint to verify that the server is running and responding.
 * Useful for monitoring, load balancers, and deployment health checks.
 * 
 * Response:
 * - Status: 200 OK
 * - Body: { status: 'ok' }
 */
app.get('/health', (req, res) => {
  // Return a simple JSON response indicating the server is healthy
  res.json({ status: 'ok' });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

// Start the Express server and begin listening for incoming HTTP requests.
// '0.0.0.0' means the server will listen on all network interfaces,
// making it accessible from outside the container/host (important for Docker).
// If 'localhost' or '127.0.0.1' were used, the server would only be accessible locally.
app.listen(PORT, '0.0.0.0', () => {
  // Log a message confirming the server has started successfully
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

