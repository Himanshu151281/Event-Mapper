# Event Mapper
Event Mapper is a simple and powerful platform for hosting and managing events. It has an easy-to-use interface and strong backend support, ensuring a smooth experience for both hosts and guests. Real-time updates and a responsive design make it a reliable choice for event management.

**Live site:** https://event-mapper.vercel.app

## Running locally

```bash
npm install
npm start          # http://localhost:8080
```

Required environment variables in `.env`: `ATLASDB_URL`, `SECRET`, `MAP_TOKEN`,
`CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET`.

In production also set `NODE_ENV=production` and `SITE_URL` (the public origin,
no trailing slash) — see [docs/SEO.md](docs/SEO.md), which documents the SEO
setup, the two steps that still need your Google account, and the backlink plan.

## Key Features

- **User Authentication**: Allow users to register and log in. Option for "Guest Login" to access limited features.
- **Event Dashboard**: Display a list of upcoming and past events with filters for categories and dates.
- **Event Creation**: Form to create an event with fields like event name, description, date/time, and more.
- **Real-Time Attendee List**: Show the number of attendees for each event in real-time.
- **Responsive Design**: Ensure the platform works seamlessly on all devices.
- **CRUD Operations**: Add, Edit, and Delete Listings.
- **Account Management**: Update User Account and Password.
- **Review System**: Users can leave reviews and ratings for listings.

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

- **Socket.io**: Library for real-time web applications.
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

- **User Authentication**: Login, Logout, and User Profile Section.
- **CRUD Operations**: Add, Edit, and Delete Listings.
- **Account Management**: Update User Account and Password.
- **Event Dashboard**: Display a list of upcoming and past events with filters for categories and dates.
- **Real-time Attendee Updates**: Using Socket.io to update the number of attendees in real-time.
- **Review System**: Users can leave reviews and ratings for listings.