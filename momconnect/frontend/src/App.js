import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import './App.css';

import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Explore from './pages/Explore';
import Groups from './pages/Groups';
import CreateGroup from './pages/CreateGroup';
import GroupDetail from './pages/GroupDetail';
import Messages from './pages/Messages';
import ChatBot from './pages/ChatBot';

import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-heart">❤️</div>
        <p>Loading MomConnect...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {user && <Navbar />}
      <div className="main-container">
        {user && <Sidebar />}
        <main className={user ? 'main-content' : 'full-width'}>
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
            <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
            <Route path="/explore" element={user ? <Explore /> : <Navigate to="/login" />} />
            <Route path="/profile/:id" element={user ? <Profile /> : <Navigate to="/login" />} />
            <Route path="/edit-profile" element={user ? <EditProfile /> : <Navigate to="/login" />} />
            <Route path="/groups" element={user ? <Groups /> : <Navigate to="/login" />} />
            <Route path="/groups/create" element={user ? <CreateGroup /> : <Navigate to="/login" />} />
            <Route path="/groups/:id" element={user ? <GroupDetail /> : <Navigate to="/login" />} />
            <Route path="/messages" element={user ? <Messages /> : <Navigate to="/login" />} />
            <Route path="/messages/:userId" element={user ? <Messages /> : <Navigate to="/login" />} />
            <Route path="/chatbot" element={user ? <ChatBot user={user} /> : <Navigate to="/login" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;