## Key Features
1. **User Authentication**: Allow users to register and log in. Option for "Guest Login" to access limited features.
2. **Event Dashboard**: Display a list of upcoming and past events with filters for categories and dates.
3. **Event Creation**: Form to create an event with fields like event name, description, date/time, and more.
4. **Real-Time Attendee List**: Show the number of attendees for each event in real-time.
5. **Responsive Design**: Ensure the platform works seamlessly on all devices.

## Technologies & Packages Used

### Backend
- **MongoDB**: NoSQL database for flexible and scalable data storage.
- **Express.js**: Web application framework for Node.js, providing robust features for web and mobile applications.
- **Node.js**: JavaScript runtime for server-side development.

### Authentication
- **Passport.js**: Middleware for user authentication, supporting various strategies.
- **Dotenv**: Environment variable management for secure configuration.

### Image Storage
- **Cloudinary**: Cloud-based image and video management solution.

### Frontend
- **EJS**: Embedded JavaScript templates for dynamic content rendering.

### Session Management
- **Connect Flash**: Middleware for flash messages.
- **Connect Mongo**: MongoDB session store for Express.js.

### Validation
- **Joi**: Library for data validation.

### Object Modeling
- **Mongoose**: MongoDB object modeling for Node.js.

### File Uploads
- **Multer**: Middleware for handling file uploads.

### Social Authentication
- **Passport Local**: Local authentication strategy.
- **Passport Local Mongoose**: Mongoose-specific authentication strategy.

### Real-time Communication
- **Socket.io**: Library for real-time web applications.

## Key Features
- **User Authentication**: Login, Logout, and User Profile Section
- **CRUD Operations**: Add, Edit, and Delete Listings
- **Account Management**: Update User Account and Password
- **Event Dashboard**: Display a list of upcoming and past events with filters for categories and dates
- **Real-time Attendee Updates**: Using Socket.io to update the number of attendees in real-time
