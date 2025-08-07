const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken'); // JWT for authentication

const app = express();
const SECRET_KEY = 'your_secret_key'; // Replace with a strong secret

// Middleware Setup
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

// Function to reset active user sessions when the server starts
const resetActiveSessions = () => {
    fs.readFile('users.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading users.json:', err);
            return;
        }

        let users = data ? JSON.parse(data) : [];

        // Clear any session-related data for all users
        users = users.map(user => ({
            ...user,
            // Reset session-related fields
            // Example: Add or reset session fields if needed
        }));

        fs.writeFile('users.json', JSON.stringify(users, null, 2), (writeErr) => {
            if (writeErr) {
                console.error('Error resetting user sessions:', writeErr);
            } else {
                console.log('All user sessions have been reset.');
            }
        });
    });
};

// Reset sessions at server startup
resetActiveSessions();

// User Registration Route
app.post('/register', (req, res) => {
    const { username, email, phone, password } = req.body;

    fs.readFile('users.json', 'utf8', (err, data) => {
        let users = data ? JSON.parse(data) : [];

        // Check if user already exists
        if (users.some(user => user.email === email || user.username === username)) {
            return res.status(400).json({ message: 'User already exists!' });
        }

        // Register the new user
        const newUser = { username, email, phone, password, orders: [] };
        users.push(newUser);

        fs.writeFile('users.json', JSON.stringify(users, null, 2), (writeErr) => {
            if (writeErr) return res.status(500).json({ message: 'Registration failed!' });
            res.status(200).json({ message: 'User registered successfully!' });
        });
    });
});

// User Login Route
app.post('/login', (req, res) => {
    const { credential, password } = req.body;

    fs.readFile('users.json', 'utf8', (err, data) => {
        let users = data ? JSON.parse(data) : [];

        const user = users.find(user => (user.email === credential || user.username === credential) && user.password === password);
        if (!user) return res.status(401).json({ message: 'Invalid credentials!' });

        // Generate JWT token for authentication
        const token = jwt.sign({ email: user.email }, SECRET_KEY, { expiresIn: '2h' });
        res.status(200).json({ message: 'Login successful!', token, username: user.username });
    });
});

// Middleware to Authenticate Requests
const authenticateUser = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(403).json({ message: 'Unauthorized!' });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Invalid Token!' });

        req.userEmail = decoded.email;
        next();
    });
};

// Route to Fetch Username for Logged-In User
app.get('/get-username', authenticateUser, (req, res) => {
    fs.readFile('users.json', 'utf8', (err, data) => {
        let users = data ? JSON.parse(data) : [];
        const user = users.find(user => user.email === req.userEmail);

        if (user) {
            return res.status(200).json({ username: user.username });
        } else {
            return res.status(404).json({ message: 'User not found!' });
        }
    });
});

// Route to Submit Order
app.post('/submit-order', authenticateUser, (req, res) => {
    const { foodName, foodPrice, quantity, totalPrice, name, number, address, instructions } = req.body;

    const newOrder = {
        foodName,
        foodPrice,
        quantity,
        totalPrice,
        name,
        number,
        address,
        instructions: instructions || 'None' // Default if no special instructions
    };

    fs.readFile('users.json', 'utf8', (err, data) => {
        let users = data ? JSON.parse(data) : [];

        const userIndex = users.findIndex(user => user.email === req.userEmail);
        if (userIndex === -1) return res.status(403).json({ message: 'User not found!' });

        users[userIndex].orders.push(newOrder);

        fs.writeFile('users.json', JSON.stringify(users, null, 2), (writeErr) => {
            if (writeErr) return res.status(500).json({ message: 'Error saving order!' });
            res.status(200).json({ message: 'Order placed successfully!' });
        });
    });
});

// Route to Get User's Orders
app.get('/orders', authenticateUser, (req, res) => {
    fs.readFile('users.json', 'utf8', (err, data) => {
        let users = data ? JSON.parse(data) : [];

        const user = users.find(user => user.email === req.userEmail);
        if (!user) return res.status(403).json({ message: 'User not found!' });

        res.status(200).json(user.orders);
    });
});

// Route to Delete an Order
app.delete('/delete-order', authenticateUser, (req, res) => {
    const { index } = req.body;

    fs.readFile('users.json', 'utf8', (err, data) => {
        let users = data ? JSON.parse(data) : [];

        const userIndex = users.findIndex(user => user.email === req.userEmail);
        if (userIndex === -1) return res.status(403).json({ message: 'User not found!' });

        if (index < 0 || index >= users[userIndex].orders.length) {
            return res.status(400).json({ message: 'Invalid order index!' });
        }

        users[userIndex].orders.splice(index, 1); // Remove the order at the specified index

        fs.writeFile('users.json', JSON.stringify(users, null, 2), (writeErr) => {
            if (writeErr) return res.status(500).json({ message: 'Error deleting order!' });
            res.status(200).json({ message: 'Order deleted successfully!' });
        });
    });
});
// Fetch admin data (all users and their orders)
app.get('/admin-data', (req, res) => {
    fs.readFile('users.json', 'utf8', (err, data) => {
        if (err) return res.status(500).json({ message: 'Error reading data!' });

        const users = JSON.parse(data);
        res.status(200).json(users);
    });
});

// Add new user
app.post('/add-user', (req, res) => {
    const { username, email, phone, password } = req.body;

    fs.readFile('users.json', 'utf8', (err, data) => {
        let users = data ? JSON.parse(data) : [];

        users.push({ username, email, phone, password, orders: [] });

        fs.writeFile('users.json', JSON.stringify(users, null, 2), (writeErr) => {
            if (writeErr) return res.status(500).json({ message: 'Error adding user!' });
            res.status(200).json({ message: 'User added successfully!' });
        });
    });
});

// Delete user
app.delete('/delete-user', (req, res) => {
    const { index } = req.body;

    fs.readFile('users.json', 'utf8', (err, data) => {
        let users = JSON.parse(data);
        if (!users[index]) return res.status(404).json({ message: 'User not found!' });

        users.splice(index, 1); // Remove user

        fs.writeFile('users.json', JSON.stringify(users, null, 2), (writeErr) => {
            if (writeErr) return res.status(500).json({ message: 'Error deleting user!' });
            res.status(200).json({ message: 'User deleted successfully!' });
        });
    });
});

// Update user details, including password
app.put('/update-user', (req, res) => {
    const { index, newEmail, newPhone, newPassword } = req.body;

    fs.readFile('users.json', 'utf8', (err, data) => {
        let users = JSON.parse(data);
        if (!users[index]) return res.status(404).json({ message: 'User not found!' });

        users[index].email = newEmail;
        users[index].phone = newPhone;
        users[index].password = newPassword; // Update password

        fs.writeFile('users.json', JSON.stringify(users, null, 2), (writeErr) => {
            if (writeErr) return res.status(500).json({ message: 'Error updating user!' });
            res.status(200).json({ message: 'User updated successfully!' });
        });
    });
});

// Start the Server
app.listen(5000, () => {
    console.log('Server is running at http://localhost:5000');
});