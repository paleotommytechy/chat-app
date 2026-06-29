import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  if (!user) return <AuthFlow />;

  return <Chat />;
}

function AuthFlow() {
  const [isLogin, setIsLogin] = React.useState(true);

  return isLogin ? (
    <Login onToggle={() => setIsLogin(false)} />
  ) : (
    <Register onToggle={() => setIsLogin(true)} />
  );
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;