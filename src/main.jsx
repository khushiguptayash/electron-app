// Import React so JSX is available to this entry module.
import React from 'react';
// Import the React DOM API that creates and owns the page's root.
import { createRoot } from 'react-dom/client';
// Import the application component that defines the visible interface.
import App from './App.jsx';
// Import the global stylesheet used by the complete React page.
import './styles.css';

// Find the HTML root element and mount the App component into it.
createRoot(document.getElementById('root')).render(<App />);
